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

const adminMetricFields = {
  jobsReceived: z.number().int().nonnegative(),
  jobsCompleted: z.number().int().nonnegative(),
  jobsFailed: z.number().int().nonnegative(),
  pagesTranslated: z.number().int().nonnegative(),
  ocrPages: z.number().int().nonnegative(),
  exportsCompleted: z.number().int().nonnegative(),
  exportsFailed: z.number().int().nonnegative(),
  pagesExported: z.number().int().nonnegative(),
  geminiQuotaErrors: z.number().int().nonnegative(),
  providerErrors: z.number().int().nonnegative(),
};

export const adminMetricSchema = z.object({
  date: z.string().date(),
  ...adminMetricFields,
});

export const adminStatsSchema = z.object({
  generatedAt: z.string().datetime(),
  periodDays: z.number().int().min(1).max(31),
  today: adminMetricSchema,
  period: z.object(adminMetricFields),
  daily: z.array(adminMetricSchema).min(1).max(31),
  limits: z.object({
    maxPagesPerJob: z.number().int().positive(),
    dailyJobLimitPerRequester: z.number().int().positive(),
    dailyPageLimitPerRequester: z.number().int().positive(),
    monthlyOcrPageCap: z.number().int().positive(),
    monthlyOcrPagesUsed: z.number().int().nonnegative(),
  }),
  gemini: z.object({
    model: z.string().min(1),
    observedCompletedJobs: z.number().int().nonnegative(),
    quotaErrors: z.number().int().nonnegative(),
    remainingQuota: z.null(),
    quotaSource: z.literal("provider-console-required"),
    quotaConsoleUrl: z.string().url(),
  }),
  privacy: z.literal("Aggregated counters only. No PDF names, document text, translations, IP addresses, or session tokens are stored in analytics."),
});

export type AdminMetric = z.infer<typeof adminMetricSchema>;
export type AdminStats = z.infer<typeof adminStatsSchema>;
