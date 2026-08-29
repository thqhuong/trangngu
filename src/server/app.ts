import { randomUUID } from "node:crypto";
import { join } from "node:path";
import Fastify, { LogController } from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { correctionMapSchema, languageOptions, progressEventSchema, type ProgressEvent } from "../shared/contracts.js";
import type { AppConfig } from "./config.js";
import { AppError, toAppError } from "./errors.js";
import { readMultipart } from "./multipart.js";
import { safeFileName } from "./security.js";
import { createBackendServices, exportPdf, translatePdf, type BackendServices } from "./workflow.js";

export async function buildApp(config: AppConfig, serviceOverrides: Partial<BackendServices> = {}) {
  const app = Fastify({
    logger: true,
    bodyLimit: config.maxPdfBytes + 8 * 1024 * 1024,
    trustProxy: config.nodeEnv === "production",
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: () => randomUUID(),
  });
  const services = createBackendServices(config, serviceOverrides);
  await app.register(multipart, {
    limits: { files: 1, fileSize: config.maxPdfBytes, fields: 8, fieldSize: 8 * 1024 * 1024 },
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    reply.header("content-security-policy", [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "worker-src 'self' blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; "));
    return payload;
  });

  app.get("/api/health", async () => ({ status: "ok", service: "trangngu" }));

  app.get("/api/config", async () => ({
    maxPdfBytes: config.maxPdfBytes,
    maxPagesPerJob: config.maxPagesPerJob,
    dailyJobLimit: config.dailyJobLimit,
    dailyPageLimit: config.dailyPageLimit,
    languages: languageOptions,
    privacyNotice: "Files are processed temporarily and are not saved by TrangNgu. Extracted content is sent to Google services. Do not upload confidential or sensitive documents.",
  }));

  app.post("/api/translations", async (request, reply) => {
    const requestId = request.id;
    const startedAt = Date.now();
    reply.hijack();
    reply.raw.statusCode = 200;
    reply.raw.setHeader("content-type", "application/x-ndjson; charset=utf-8");
    reply.raw.setHeader("cache-control", "no-store");
    reply.raw.setHeader("x-content-type-options", "nosniff");
    reply.raw.setHeader("x-request-id", requestId);
    const emit = (event: ProgressEvent) => reply.raw.write(`${JSON.stringify(progressEventSchema.parse(event))}\n`);
    try {
      const multipartPayload = await readMultipart(request, config.maxPdfBytes);
      const session = await translatePdf({
        file: multipartPayload.file,
        fileName: multipartPayload.fileName,
        targetLanguage: multipartPayload.fields.targetLanguage ?? "",
        requesterIp: request.ip,
        requestId,
      }, config, services, emit);
      emit({ type: "ready", session });
      app.log.info({ requestId, route: "translations", stage: "complete", pageCount: session.pageCount, durationMs: Date.now() - startedAt }, "workflow complete");
    } catch (error) {
      const safe = toAppError(error);
      emit({ type: "error", code: safe.code, message: safe.message, requestId });
      app.log.warn({ requestId, route: "translations", stage: "failed", code: safe.code, durationMs: Date.now() - startedAt }, "workflow failed");
    } finally {
      reply.raw.end();
    }
  });

  app.post("/api/exports", async (request, reply) => {
    const requestId = request.id;
    const startedAt = Date.now();
    try {
      const multipartPayload = await readMultipart(request, config.maxPdfBytes);
      let correctionInput: unknown = {};
      if (multipartPayload.fields.corrections) {
        try {
          correctionInput = JSON.parse(multipartPayload.fields.corrections) as unknown;
        } catch {
          throw new AppError("INVALID_CORRECTIONS", "Corrections must be valid JSON.");
        }
      }
      const result = await exportPdf({
        file: multipartPayload.file,
        sessionToken: multipartPayload.fields.sessionToken ?? "",
        corrections: correctionMapSchema.parse(correctionInput),
      }, config, services);
      const sourceName = safeFileName(result.session.fileName).replace(/\.pdf$/i, "");
      const outputName = `${sourceName || "document"}-translated.pdf`;
      app.log.info({ requestId, route: "exports", stage: "complete", pageCount: result.session.pageCount, durationMs: Date.now() - startedAt }, "workflow complete");
      return reply
        .header("x-request-id", requestId)
        .header("cache-control", "no-store")
        .header("content-type", "application/pdf")
        .header("content-disposition", `attachment; filename="translated.pdf"; filename*=UTF-8''${encodeURIComponent(outputName)}`)
        .send(result.buffer);
    } catch (error) {
      const safe = error instanceof AppError ? error : error instanceof Error && error.name === "ZodError"
        ? new AppError("INVALID_CORRECTIONS", "One or more text corrections are invalid.")
        : toAppError(error);
      app.log.warn({ requestId, route: "exports", stage: "failed", code: safe.code, durationMs: Date.now() - startedAt }, "workflow failed");
      return reply.status(safe.statusCode).header("x-request-id", requestId).send({
        error: { code: safe.code, message: safe.message, requestId },
      });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const safe = toAppError(error);
    app.log.warn({ requestId: request.id, route: "unhandled", stage: "failed", code: safe.code }, "request failed");
    void reply.status(safe.statusCode).send({ error: { code: safe.code, message: safe.message, requestId: request.id } });
  });

  if (config.nodeEnv === "production") {
    await app.register(fastifyStatic, {
      root: join(process.cwd(), "dist", "client"),
      wildcard: false,
      cacheControl: true,
      maxAge: "1h",
      immutable: false,
    });
  }

  return app;
}
