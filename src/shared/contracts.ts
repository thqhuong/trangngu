import { z } from "zod";

export const languageOptions = [
  { code: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt" },
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "zh-CN", label: "Chinese (Simplified)", nativeLabel: "简体中文" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" },
  { code: "ko", label: "Korean", nativeLabel: "한국어" },
  { code: "th", label: "Thai", nativeLabel: "ไทย" },
  { code: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
] as const;

export const languageCodeSchema = z.enum(languageOptions.map((option) => option.code));
export type LanguageCode = z.infer<typeof languageCodeSchema>;

export const boundingBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine(({ x, width }) => x + width <= 1.000_001, "Box exceeds page width")
  .refine(({ y, height }) => y + height <= 1.000_001, "Box exceeds page height");

export const textStyleSchema = z.object({
  fontSize: z.number().positive().max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bold: z.boolean(),
  italic: z.boolean(),
  align: z.enum(["left", "center", "right"]),
});

export const translationBlockSchema = z.object({
  id: z.string().min(1).max(80),
  page: z.number().int().positive(),
  box: boundingBoxSchema,
  originalText: z.string().min(1).max(10_000),
  translatedText: z.string().min(1).max(20_000),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
  reviewReason: z.string().max(240).optional(),
  style: textStyleSchema,
});

export type TranslationBlock = z.infer<typeof translationBlockSchema>;

export const pageLayoutSchema = z.object({
  page: z.number().int().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  extraction: z.enum(["embedded", "document-ai"]),
  blocks: z.array(translationBlockSchema).max(1_500),
});

export const translationSessionSchema = z
  .object({
    requestId: z.string().uuid(),
    fileName: z.string().min(1).max(200),
    documentHash: z.string().length(64),
    targetLanguage: languageCodeSchema,
    pageCount: z.number().int().min(1).max(15),
    expiresAt: z.string().datetime(),
    pages: z.array(pageLayoutSchema).min(1).max(15),
    sessionToken: z.string().min(20),
  })
  .refine(({ pageCount, pages }) => pageCount === pages.length, "Page count mismatch");

export type TranslationSession = z.infer<typeof translationSessionSchema>;

export const correctionMapSchema = z
  .record(z.string().min(1).max(80), z.string().min(1).max(20_000))
  .refine((value) => Object.keys(value).length <= 1_500, "Too many corrections");

export const progressEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("progress"), stage: z.enum(["validating", "extracting", "translating", "preparing"]), message: z.string(), progress: z.number().min(0).max(100) }),
  z.object({ type: z.literal("ready"), session: translationSessionSchema }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string(), requestId: z.string().optional() }),
]);

export type ProgressEvent = z.infer<typeof progressEventSchema>;

export const publicConfigSchema = z.object({
  maxPdfBytes: z.number().int().positive(),
  maxPagesPerJob: z.number().int().positive(),
  dailyJobLimit: z.number().int().positive(),
  dailyPageLimit: z.number().int().positive(),
  languages: z.array(z.object({ code: languageCodeSchema, label: z.string(), nativeLabel: z.string() })),
  privacyNotice: z.string(),
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;
