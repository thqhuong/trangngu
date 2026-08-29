import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, exportTranslation, loadAdminStats, streamTranslation } from "./api";

const readyEvent = {
  type: "ready",
  session: {
    requestId: "123e4567-e89b-12d3-a456-426614174000",
    fileName: "guide.pdf",
    documentHash: "a".repeat(64),
    targetLanguage: "vi",
    pageCount: 1,
    expiresAt: "2026-08-29T08:00:00.000Z",
    pages: [{
      page: 1,
      width: 612,
      height: 792,
      extraction: "embedded",
      blocks: [{
        id: "block-1",
        page: 1,
        box: { x: 0.1, y: 0.1, width: 0.5, height: 0.1 },
        originalText: "Flood safety",
        translatedText: "An toàn mùa lũ",
        confidence: 0.98,
        needsReview: false,
        style: { fontSize: 12, color: "#111111", bold: true, italic: false, align: "left" },
      }],
    }],
    sessionToken: "signed-session-token-long-enough",
  },
} as const;

function streamedResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  }), { status: 200, headers: { "content-type": "application/x-ndjson" } });
}

afterEach(() => vi.restoreAllMocks());

describe("streamTranslation", () => {
  it("parses NDJSON events split across network chunks", async () => {
    const progress = JSON.stringify({ type: "progress", stage: "extracting", message: "Reading", progress: 35 });
    const ready = JSON.stringify(readyEvent);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(streamedResponse([
      `${progress}\n${ready.slice(0, 51)}`,
      `${ready.slice(51)}\n`,
    ]));
    const events: string[] = [];

    const session = await streamTranslation(
      new File(["%PDF"], "guide.pdf", { type: "application/pdf" }),
      "vi",
      (event) => events.push(event.type),
    );

    expect(events).toEqual(["progress", "ready"]);
    expect(session.pages[0]?.blocks[0]?.translatedText).toBe("An toàn mùa lũ");
  });

  it("surfaces structured stream errors with request IDs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(streamedResponse([
      `${JSON.stringify({ type: "error", code: "MODEL_QUOTA", message: "Quota reached", requestId: "req-7" })}\n`,
    ]));

    await expect(streamTranslation(
      new File(["%PDF"], "guide.pdf", { type: "application/pdf" }),
      "vi",
      () => undefined,
    )).rejects.toMatchObject({ code: "MODEL_QUOTA", requestId: "req-7" } satisfies Partial<ApiError>);
  });
});

describe("exportTranslation", () => {
  it("uses the UTF-8 download filename returned by the API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Blob(["pdf"]), {
      status: 200,
      headers: { "content-disposition": "attachment; filename*=UTF-8''T%C3%A0i-li%E1%BB%87u-vi.pdf" },
    }));

    const result = await exportTranslation(
      new File(["%PDF"], "guide.pdf", { type: "application/pdf" }),
      "signed-session-token-long-enough",
      { "block-1": "Bản dịch đã sửa" },
      { "block-1": { width: 0.6, height: 0.15 } },
    );

    expect(result.fileName).toBe("Tài-liệu-vi.pdf");
    expect(result.blob.size).toBeGreaterThan(0);
    const request = fetchMock.mock.calls[0]?.[1];
    const form = request?.body as FormData;
    expect(JSON.parse(String(form.get("boxAdjustments")))).toEqual({ "block-1": { width: 0.6, height: 0.15 } });
  });
});

describe("loadAdminStats", () => {
  it("sends the key in memory and validates aggregate counters", async () => {
    const metric = {
      date: "2026-08-29", jobsReceived: 1, jobsCompleted: 1, jobsFailed: 0, pagesTranslated: 4,
      ocrPages: 1, exportsCompleted: 1, exportsFailed: 0, pagesExported: 4, geminiQuotaErrors: 0, providerErrors: 0,
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      generatedAt: "2026-08-29T09:00:00.000Z", periodDays: 30, today: metric, period: { ...metric, date: undefined }, daily: [metric],
      limits: { maxPagesPerJob: 15, dailyJobLimitPerRequester: 3, dailyPageLimitPerRequester: 45, monthlyOcrPageCap: 900, monthlyOcrPagesUsed: 2 },
      gemini: { model: "gemini-test", observedCompletedJobs: 1, quotaErrors: 0, remainingQuota: null, quotaSource: "provider-console-required", quotaConsoleUrl: "https://console.cloud.google.com/iam-admin/quotas" },
      privacy: "Aggregated counters only. No PDF names, document text, translations, IP addresses, or session tokens are stored in analytics.",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const stats = await loadAdminStats("admin-access-key-that-is-long-enough");

    expect(stats.today.pagesTranslated).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/stats", expect.objectContaining({
      headers: { Authorization: "Bearer admin-access-key-that-is-long-enough" },
      cache: "no-store",
    }));
  });
});
