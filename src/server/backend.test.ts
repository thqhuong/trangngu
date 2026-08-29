// @vitest-environment node
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { AppError } from "./errors.js";
import { inspectPdf } from "./pdf.js";
import type { TranslationProvider } from "./providers.js";
import { MemoryQuotaStore } from "./quota.js";
import { sha256, signSession, verifySession, type SessionPayload } from "./security.js";
import { createBackendServices, exportPdf, translatePdf } from "./workflow.js";

const config = loadConfig({
  NODE_ENV: "test",
  SESSION_SIGNING_SECRET: "s".repeat(32),
  IP_HASH_SALT: "i".repeat(16),
});

const translator: TranslationProvider = {
  async translate(blocks) {
    return new Map(blocks.map((block) => [block.id, "Xin chao, day la tai lieu thu nghiem."]));
  },
};

async function fixturePdf(pages = 1): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index += 1) {
    const page = document.addPage([400, 300]);
    page.drawText(`Hello this is a representative source document page ${index + 1}.`, {
      x: 40,
      y: 220,
      size: 14,
      font,
      color: rgb(0.05, 0.05, 0.05),
    });
  }
  return Buffer.from(await document.save());
}

function multipart(fields: Record<string, string>, file: Buffer): { payload: Buffer; contentType: string } {
  const boundary = "trangngu-test-boundary";
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="source.pdf"\r\nContent-Type: application/pdf\r\n\r\n`));
  chunks.push(file, Buffer.from(`\r\n--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

describe("public API", () => {
  it("reports health and the recommended limits", async () => {
    const app = await buildApp(config, { translator });
    const health = await app.inject({ method: "GET", url: "/api/health" });
    expect(health.json()).toEqual({ status: "ok", service: "trangngu" });
    const publicConfig = await app.inject({ method: "GET", url: "/api/config" });
    expect(publicConfig.json()).toMatchObject({ maxPdfBytes: 25 * 1024 * 1024, maxPagesPerJob: 15, dailyJobLimit: 3, dailyPageLimit: 45 });
    await app.close();
  }, 15_000);

  it("streams progress and a schema-valid ready session", async () => {
    const app = await buildApp(config, { translator });
    const body = multipart({ targetLanguage: "vi" }, await fixturePdf());
    const response = await app.inject({
      method: "POST",
      url: "/api/translations",
      headers: { "content-type": body.contentType },
      payload: body.payload,
    });
    const events = response.body.trim().split("\n").map((line) => JSON.parse(line) as { type: string; session?: { pageCount: number } });
    expect(events.map((event) => event.type)).toEqual(["progress", "progress", "progress", "progress", "ready"]);
    expect(events.at(-1)?.session?.pageCount).toBe(1);
    await app.close();
  });

  it("returns a safe NDJSON error for an invalid target", async () => {
    const app = await buildApp(config, { translator });
    const body = multipart({ targetLanguage: "xx" }, await fixturePdf());
    const response = await app.inject({ method: "POST", url: "/api/translations", headers: { "content-type": body.contentType }, payload: body.payload });
    expect(response.body).toContain('"code":"UNSUPPORTED_LANGUAGE"');
    expect(response.body).not.toContain("ZodError");
    await app.close();
  });
});

describe("PDF workflow", () => {
  it("rejects non-PDF input and page-count overflow", async () => {
    await expect(inspectPdf(Buffer.from("not a pdf"), config)).rejects.toMatchObject({ code: "INVALID_PDF" });
    await expect(inspectPdf(await fixturePdf(16), config)).rejects.toMatchObject({ code: "PAGE_LIMIT" });
  });

  it("binds a signed session to the original document", async () => {
    const source = await fixturePdf();
    const services = createBackendServices(config, { translator });
    const session = await translatePdf({ file: source, fileName: "source.pdf", targetLanguage: "vi", requesterIp: "127.0.0.1" }, config, services, () => undefined);
    await expect(exportPdf({ file: await fixturePdf(2), sessionToken: session.sessionToken, corrections: {} }, config, services))
      .rejects.toMatchObject({ code: "DOCUMENT_MISMATCH" });
  });

  it("renders an exported PDF whose translated text is searchable", async () => {
    const source = await fixturePdf();
    const services = createBackendServices(config, { translator });
    const session = await translatePdf({ file: source, fileName: "source.pdf", targetLanguage: "vi", requesterIp: "127.0.0.2" }, config, services, () => undefined);
    const result = await exportPdf({ file: source, sessionToken: session.sessionToken, corrections: {} }, config, services);
    expect(result.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    const inspection = await inspectPdf(result.buffer, config);
    expect(inspection.embeddedPages.flatMap((page) => page.blocks).map((block) => block.originalText).join(" ")).toContain("Xin chao");
  }, 30_000);

  it("fits a compact translation into a tight source block", async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const page = document.addPage([240, 120]);
    page.drawText("Pack essentials and monitor official updates.", { x: 20, y: 70, size: 8, font });
    const source = Buffer.from(await document.save());
    const compactTranslator: TranslationProvider = {
      async translate(blocks) {
        return new Map(blocks.map((block) => [block.id, "Mang do thiet yeu; theo doi thong bao chinh thuc."]));
      },
    };
    const services = createBackendServices(config, { translator: compactTranslator });
    const session = await translatePdf({ file: source, fileName: "tight.pdf", targetLanguage: "vi", requesterIp: "127.0.0.3" }, config, services, () => undefined);
    const result = await exportPdf({ file: source, sessionToken: session.sessionToken, corrections: {} }, config, services);
    expect(result.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});

describe("security and quotas", () => {
  it("rejects expired and tampered session tokens", () => {
    const payload: SessionPayload = {
      version: 1,
      requestId: "00000000-0000-4000-8000-000000000000",
      fileName: "a.pdf",
      documentHash: sha256(Buffer.from("a")),
      targetLanguage: "vi",
      pageCount: 1,
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      pages: [],
    };
    const token = signSession(payload, "s".repeat(32));
    expect(() => verifySession(token, "s".repeat(32))).toThrowError(AppError);
    expect(() => verifySession(`${token}x`, "s".repeat(32))).toThrowError(AppError);
  });

  it("enforces daily job/page and monthly OCR limits", async () => {
    const quota = new MemoryQuotaStore({ dailyJobLimit: 1, dailyPageLimit: 2, monthlyOcrPageCap: 2 });
    await quota.reserveDaily("user", 2);
    await expect(quota.reserveDaily("user", 1)).rejects.toMatchObject({ code: "DAILY_JOB_LIMIT" });
    await quota.reserveOcr(2);
    await expect(quota.reserveOcr(1)).rejects.toMatchObject({ code: "OCR_CAP_REACHED" });
  });
});
