import { describe, expect, it } from "vitest";
import {
  boundingBoxSchema,
  correctionMapSchema,
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
});
