import { describe, expect, it } from "vitest";
import {
  adminStatsSchema,
  boxAdjustmentMapSchema,
  boundingBoxSchema,
  correctionMapSchema,
  excludedBlockIdsSchema,
  fontSizeAdjustmentMapSchema,
  languageCodeSchema,
  languageOptions,
  translationSessionSchema,
} from "./contracts";

describe("shared API contracts", () => {
  it("publishes the twelve tested target languages", () => {
    expect(languageOptions).toHaveLength(12);
    expect(languageCodeSchema.parse("vi")).toBe("vi");
    expect(() => languageCodeSchema.parse("ar")).toThrow();
  });

  it("rejects geometry that escapes a normalized page", () => {
    expect(
      boundingBoxSchema.safeParse({ x: -0.01, y: 0, width: 0.5, height: 0.5 }).success,
    ).toBe(false);
    expect(
      boundingBoxSchema.safeParse({ x: 0.1, y: 0.2, width: 0.4, height: 0.3 }).success,
    ).toBe(true);
  });

  it("limits correction payloads", () => {
    expect(correctionMapSchema.parse({ "p1-b1": "Xin chào" })).toEqual({
      "p1-b1": "Xin chào",
    });
    expect(correctionMapSchema.safeParse({ "": "text" }).success).toBe(false);
  });

  it("validates user-controlled PDF text-box sizes", () => {
    expect(boxAdjustmentMapSchema.parse({ "p1-b1": { width: 0.42, height: 0.12 } })).toEqual({
      "p1-b1": { width: 0.42, height: 0.12 },
    });
    expect(boxAdjustmentMapSchema.safeParse({ "p1-b1": { width: 1.2, height: 0.1 } }).success).toBe(false);
  });

  it("validates text-size and keep-original export choices", () => {
    expect(fontSizeAdjustmentMapSchema.parse({ "p1-b1": 8.5 })).toEqual({ "p1-b1": 8.5 });
    expect(fontSizeAdjustmentMapSchema.safeParse({ "p1-b1": 0.5 }).success).toBe(false);
    expect(excludedBlockIdsSchema.parse(["p1-b1", "p1-b2"])).toEqual(["p1-b1", "p1-b2"]);
    expect(excludedBlockIdsSchema.safeParse(["p1-b1", "p1-b1"]).success).toBe(false);
  });

  it("does not accept sessions above the public page limit", () => {
    const result = translationSessionSchema.safeParse({
      requestId: "4fb7ac5e-7580-435d-845b-edf7623d7604",
      fileName: "sample.pdf",
      documentHash: "a".repeat(64),
      targetLanguage: "vi",
      pageCount: 16,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      pages: [],
      sessionToken: "x".repeat(20),
    });

    expect(result.success).toBe(false);
  });

  it("validates privacy-safe admin statistics", () => {
    const metric = {
      date: "2026-08-29",
      jobsReceived: 2,
      jobsCompleted: 1,
      jobsFailed: 1,
      pagesTranslated: 4,
      ocrPages: 1,
      exportsCompleted: 1,
      exportsFailed: 0,
      pagesExported: 4,
      geminiQuotaErrors: 0,
      providerErrors: 0,
    };
    expect(adminStatsSchema.parse({
      generatedAt: "2026-08-29T09:00:00.000Z",
      periodDays: 30,
      today: metric,
      period: Object.fromEntries(Object.entries(metric).filter(([key]) => key !== "date")),
      daily: [metric],
      limits: {
        maxPagesPerJob: 15,
        dailyJobLimitPerRequester: 3,
        dailyPageLimitPerRequester: 45,
        monthlyOcrPageCap: 900,
        monthlyOcrPagesUsed: 12,
      },
      gemini: {
        model: "gemini-test",
        observedCompletedJobs: 1,
        quotaErrors: 0,
        remainingQuota: null,
        quotaSource: "provider-console-required",
        quotaConsoleUrl: "https://console.cloud.google.com/iam-admin/quotas",
      },
      privacy: "Aggregated counters only. No PDF names, document text, translations, IP addresses, or session tokens are stored in analytics.",
    }).today.pagesTranslated).toBe(4);
  });
});
