// @vitest-environment node
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { AppError } from "./errors.js";
import { inspectPdf } from "./pdf.js";
import { estimateOcrFontSize, makeBatches, type TranslationProvider } from "./providers.js";
import { MemoryQuotaStore } from "./quota.js";
import { sha256, signSession, verifySession, type SessionPayload } from "./security.js";
import { MemoryTelemetryStore } from "./telemetry.js";
import { createBackendServices, exportPdf, translatePdf } from "./workflow.js";

const config = loadConfig({
  NODE_ENV: "test",
  SESSION_SIGNING_SECRET: "s".repeat(32),
  IP_HASH_SALT: "i".repeat(16),
});

describe("OCR typography", () => {
  it("starts dense Korean paragraphs smaller than short labels", () => {
    const shortLabel = estimateOcrFontSize("도미넌트 코드", 240, 48);
    const denseParagraph = estimateOcrFontSize("한국어 문장은 같은 의미의 영어 문장보다 글자 수와 줄바꿈이 크게 달라질 수 있습니다.".repeat(7), 520, 150);
    expect(shortLabel).toBeGreaterThan(denseParagraph);
    expect(denseParagraph).toBeGreaterThanOrEqual(6);
    expect(shortLabel).toBeLessThanOrEqual(48);
  });
});

describe("Gemini batching", () => {
  it("keeps dense OCR responses below both block and character ceilings", () => {
    const blocks = Array.from({ length: 81 }, (_, index) => ({
      id: `p1-o${index + 1}`,
      page: 1,
      box: { x: 0, y: 0, width: 0.2, height: 0.05 },
      originalText: "가".repeat(160),
      translatedText: "",
      confidence: 0.9,
      needsReview: false,
      style: { fontSize: 10, color: "#111111", bold: false, italic: false, align: "left" as const },
    }));
    const batches = makeBatches(blocks);
    expect(batches.length).toBeGreaterThan(2);
    expect(batches.every((batch) => batch.length <= 40)).toBe(true);
    expect(batches.every((batch) => batch.reduce((total, block) => total + block.originalText.length, 0) <= 6_000)).toBe(true);
  });
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

  it("lets an authenticated owner bypass only the per-requester daily limit", async () => {
    const ownerToken = "owner-access-key-that-is-long-enough";
    const ownerConfig = loadConfig({
      NODE_ENV: "test",
      SESSION_SIGNING_SECRET: "s".repeat(32),
      IP_HASH_SALT: "i".repeat(16),
      ADMIN_DASHBOARD_TOKEN: ownerToken,
      DAILY_JOB_LIMIT: "1",
      DAILY_PAGE_LIMIT: "1",
    });
    const app = await buildApp(ownerConfig, { translator });
    const source = await fixturePdf();
    const send = (authorization?: string) => {
      const body = multipart({ targetLanguage: "vi" }, source);
      return app.inject({
        method: "POST",
        url: "/api/translations",
        headers: { "content-type": body.contentType, ...(authorization ? { authorization } : {}) },
        payload: body.payload,
      });
    };

    expect((await send()).body).toContain('"type":"ready"');
    expect((await send(`Bearer ${ownerToken}`)).body).toContain('"type":"ready"');
    expect((await send()).body).toContain('"code":"DAILY_JOB_LIMIT"');
    expect((await send("Bearer incorrect-owner-access-key")).body).toContain('"code":"ADMIN_UNAUTHORIZED"');
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

  it("does not create overlays when the translator preserves technical content", async () => {
    const source = await fixturePdf();
    const preservingTranslator: TranslationProvider = {
      async translate(blocks) {
        return new Map(blocks.map((block) => [block.id, block.originalText]));
      },
    };
    const services = createBackendServices(config, { translator: preservingTranslator });
    await expect(translatePdf({ file: source, fileName: "technical.pdf", targetLanguage: "vi", requesterIp: "127.0.0.6" }, config, services, () => undefined))
      .rejects.toMatchObject({ code: "INVALID_PDF", message: expect.stringContaining("preserving notation") });
  });

  it("exports a validated user-resized translation box", async () => {
    const source = await fixturePdf();
    const services = createBackendServices(config, { translator });
    const session = await translatePdf({ file: source, fileName: "resized.pdf", targetLanguage: "vi", requesterIp: "127.0.0.4" }, config, services, () => undefined);
    const block = session.pages[0]!.blocks[0]!;
    const result = await exportPdf({
      file: source,
      sessionToken: session.sessionToken,
      corrections: {},
      boxAdjustments: {
        [block.id]: {
          width: Math.min(1 - block.box.x, block.box.width * 1.15),
          height: Math.min(1 - block.box.y, block.box.height * 1.4),
        },
      },
    }, config, services);
    expect(result.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    await expect(exportPdf({
      file: source,
      sessionToken: session.sessionToken,
      corrections: {},
      boxAdjustments: { [block.id]: { width: 1, height: 1 } },
    }, config, services)).rejects.toMatchObject({ code: "INVALID_CORRECTIONS" });
  }, 30_000);

  it("applies user text size and can preserve a selected original block", async () => {
    const source = await fixturePdf();
    const services = createBackendServices(config, { translator });
    const session = await translatePdf({ file: source, fileName: "reviewed.pdf", targetLanguage: "vi", requesterIp: "127.0.0.5" }, config, services, () => undefined);
    const block = session.pages[0]!.blocks[0]!;
    const resized = await exportPdf({
      file: source,
      sessionToken: session.sessionToken,
      corrections: {},
      fontSizeAdjustments: { [block.id]: 7.5 },
    }, config, services);
    expect((await inspectPdf(resized.buffer, config)).embeddedPages.flatMap((page) => page.blocks)
      .map((item) => item.originalText).join(" ")).toContain("Xin chao");

    const preserved = await exportPdf({
      file: source,
      sessionToken: session.sessionToken,
      corrections: {},
      excludedBlockIds: [block.id],
    }, config, services);
    expect((await inspectPdf(preserved.buffer, config)).embeddedPages.flatMap((page) => page.blocks)
      .map((item) => item.originalText).join(" ")).not.toContain("Xin chao");

    await expect(exportPdf({
      file: source,
      sessionToken: session.sessionToken,
      corrections: {},
      fontSizeAdjustments: { unknown: 8 },
    }, config, services)).rejects.toMatchObject({ code: "INVALID_CORRECTIONS" });
    await expect(exportPdf({
      file: source,
      sessionToken: session.sessionToken,
      corrections: {},
      excludedBlockIds: ["unknown"],
    }, config, services)).rejects.toMatchObject({ code: "INVALID_CORRECTIONS" });
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

  it("protects aggregated admin statistics without exposing document data", async () => {
    const adminConfig = loadConfig({
      NODE_ENV: "test",
      SESSION_SIGNING_SECRET: "s".repeat(32),
      IP_HASH_SALT: "i".repeat(16),
      ADMIN_DASHBOARD_TOKEN: "admin-access-key-that-is-long-enough",
      MONTHLY_OCR_PAGE_CAP: "900",
    });
    const telemetry = new MemoryTelemetryStore();
    const quota = new MemoryQuotaStore(adminConfig);
    await telemetry.record({ jobsReceived: 3, jobsCompleted: 2, jobsFailed: 1, pagesTranslated: 7, geminiQuotaErrors: 1 });
    await quota.reserveOcr(4);
    const app = await buildApp(adminConfig, { translator, telemetry, quota });

    const unauthorized = await app.inject({ method: "GET", url: "/api/admin/stats" });
    expect(unauthorized.statusCode).toBe(401);

    const response = await app.inject({
      method: "GET",
      url: "/api/admin/stats",
      headers: { authorization: "Bearer admin-access-key-that-is-long-enough" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      today: { jobsReceived: 3, jobsCompleted: 2, pagesTranslated: 7 },
      limits: { monthlyOcrPageCap: 900, monthlyOcrPagesUsed: 4 },
      gemini: { remainingQuota: null, quotaErrors: 1 },
    });
    expect(response.body).not.toContain("source.pdf");
    await app.close();
  });
});
