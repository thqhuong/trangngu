import { randomUUID } from "node:crypto";
import { join } from "node:path";
import Fastify, { LogController } from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { adminStatsSchema, boxAdjustmentMapSchema, correctionMapSchema, languageOptions, progressEventSchema, type ProgressEvent } from "../shared/contracts.js";
import type { AppConfig } from "./config.js";
import { AppError, toAppError } from "./errors.js";
import { readMultipart } from "./multipart.js";
import { safeFileName, secureStringEqual } from "./security.js";
import type { DailyMetric, MetricDelta } from "./telemetry.js";
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
  const failedAdminAttempts = new Map<string, { count: number; resetAt: number }>();
  const recordMetric = async (delta: MetricDelta) => {
    try {
      await services.telemetry.record(delta, services.now());
    } catch {
      app.log.warn({ route: "telemetry", stage: "write_failed" }, "analytics counter write failed");
    }
  };
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

  app.get("/api/admin/stats", async (request, reply) => {
    reply.header("cache-control", "no-store");
    if (!config.adminDashboardToken) {
      return reply.status(503).send({ error: { code: "ADMIN_DISABLED", message: "The admin dashboard is not configured." } });
    }

    const nowMs = Date.now();
    const attempt = failedAdminAttempts.get(request.ip);
    if (attempt && attempt.resetAt > nowMs && attempt.count >= 5) {
      return reply.status(429).send({ error: { code: "ADMIN_RATE_LIMITED", message: "Too many attempts. Try again later." } });
    }
    if (attempt && attempt.resetAt <= nowMs) failedAdminAttempts.delete(request.ip);

    const authorization = request.headers.authorization ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token || token.length > 256 || !secureStringEqual(token, config.adminDashboardToken)) {
      const current = failedAdminAttempts.get(request.ip);
      failedAdminAttempts.set(request.ip, {
        count: (current?.resetAt ?? 0) > nowMs ? current!.count + 1 : 1,
        resetAt: (current?.resetAt ?? 0) > nowMs ? current!.resetAt : nowMs + 15 * 60_000,
      });
      return reply.status(401).send({ error: { code: "ADMIN_UNAUTHORIZED", message: "The admin access key is not valid." } });
    }
    failedAdminAttempts.delete(request.ip);

    const periodDays = 30;
    const now = services.now();
    const [daily, monthlyOcrPagesUsed] = await Promise.all([
      services.telemetry.getDaily(periodDays, now),
      services.quota.getMonthlyOcrUsage(now),
    ]);
    const metricFields = [
      "jobsReceived", "jobsCompleted", "jobsFailed", "pagesTranslated", "ocrPages",
      "exportsCompleted", "exportsFailed", "pagesExported", "geminiQuotaErrors", "providerErrors",
    ] as const satisfies ReadonlyArray<Exclude<keyof DailyMetric, "date">>;
    const period = Object.fromEntries(metricFields.map((field) => [
      field,
      daily.reduce((total, day) => total + day[field], 0),
    ]));
    const projectQuery = config.googleCloudProject ? `?project=${encodeURIComponent(config.googleCloudProject)}` : "";
    return reply.send(adminStatsSchema.parse({
      generatedAt: now.toISOString(),
      periodDays,
      today: daily[0],
      period,
      daily,
      limits: {
        maxPagesPerJob: config.maxPagesPerJob,
        dailyJobLimitPerRequester: config.dailyJobLimit,
        dailyPageLimitPerRequester: config.dailyPageLimit,
        monthlyOcrPageCap: config.monthlyOcrPageCap,
        monthlyOcrPagesUsed,
      },
      gemini: {
        model: config.geminiModel,
        observedCompletedJobs: period.jobsCompleted,
        quotaErrors: period.geminiQuotaErrors,
        remainingQuota: null,
        quotaSource: "provider-console-required",
        quotaConsoleUrl: `https://console.cloud.google.com/iam-admin/quotas${projectQuery}`,
      },
      privacy: "Aggregated counters only. No PDF names, document text, translations, IP addresses, or session tokens are stored in analytics.",
    }));
  });

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
    await recordMetric({ jobsReceived: 1 });
    try {
      const multipartPayload = await readMultipart(request, config.maxPdfBytes);
      const session = await translatePdf({
        file: multipartPayload.file,
        fileName: multipartPayload.fileName,
        targetLanguage: multipartPayload.fields.targetLanguage ?? "",
        requesterIp: request.ip,
        requestId,
      }, config, services, emit);
      await recordMetric({
        jobsCompleted: 1,
        pagesTranslated: session.pageCount,
        ocrPages: session.pages.filter((page) => page.extraction === "document-ai").length,
      });
      emit({ type: "ready", session });
      app.log.info({ requestId, route: "translations", stage: "complete", pageCount: session.pageCount, durationMs: Date.now() - startedAt }, "workflow complete");
    } catch (error) {
      const safe = toAppError(error);
      await recordMetric({
        jobsFailed: 1,
        geminiQuotaErrors: safe.code === "MODEL_QUOTA" ? 1 : 0,
        providerErrors: /^(MODEL|OCR)_/.test(safe.code) ? 1 : 0,
      });
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
      let boxAdjustmentInput: unknown = {};
      if (multipartPayload.fields.corrections) {
        try {
          correctionInput = JSON.parse(multipartPayload.fields.corrections) as unknown;
        } catch {
          throw new AppError("INVALID_CORRECTIONS", "Corrections must be valid JSON.");
        }
      }
      if (multipartPayload.fields.boxAdjustments) {
        try {
          boxAdjustmentInput = JSON.parse(multipartPayload.fields.boxAdjustments) as unknown;
        } catch {
          throw new AppError("INVALID_CORRECTIONS", "Text-box adjustments must be valid JSON.");
        }
      }
      const result = await exportPdf({
        file: multipartPayload.file,
        sessionToken: multipartPayload.fields.sessionToken ?? "",
        corrections: correctionMapSchema.parse(correctionInput),
        boxAdjustments: boxAdjustmentMapSchema.parse(boxAdjustmentInput),
      }, config, services);
      const sourceName = safeFileName(result.session.fileName).replace(/\.pdf$/i, "");
      const outputName = `${sourceName || "document"}-translated.pdf`;
      await recordMetric({ exportsCompleted: 1, pagesExported: result.session.pageCount });
      app.log.info({ requestId, route: "exports", stage: "complete", pageCount: result.session.pageCount, durationMs: Date.now() - startedAt }, "workflow complete");
      return reply
        .header("x-request-id", requestId)
        .header("cache-control", "no-store")
        .header("content-type", "application/pdf")
        .header("content-disposition", `attachment; filename="translated.pdf"; filename*=UTF-8''${encodeURIComponent(outputName)}`)
        .send(result.buffer);
    } catch (error) {
      const safe = error instanceof AppError ? error : error instanceof Error && error.name === "ZodError"
        ? new AppError("INVALID_CORRECTIONS", "One or more text corrections or box sizes are invalid.")
        : toAppError(error);
      await recordMetric({ exportsFailed: 1 });
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
