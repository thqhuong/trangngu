import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(8787),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  DOCUMENT_AI_LOCATION: z.string().default("asia-southeast1"),
  DOCUMENT_AI_PROCESSOR_ID: z.string().optional(),
  SESSION_SIGNING_SECRET: z.string().min(32).optional(),
  IP_HASH_SALT: z.string().min(16).optional(),
  MAX_PDF_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  MAX_PAGES_PER_JOB: z.coerce.number().int().min(1).max(15).default(15),
  DAILY_JOB_LIMIT: z.coerce.number().int().positive().default(3),
  DAILY_PAGE_LIMIT: z.coerce.number().int().positive().default(45),
  MONTHLY_OCR_PAGE_CAP: z.coerce.number().int().positive().default(900),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  DOCUMENT_AI_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  PDF_RENDER_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  POPPLER_BIN_PATH: z.string().optional(),
  PDF_FONT_REGULAR_PATH: z.string().optional(),
  FIRESTORE_DATABASE_ID: z.string().default("(default)"),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const value = envSchema.parse(env);
  return {
    nodeEnv: value.NODE_ENV,
    host: value.HOST,
    port: value.PORT,
    geminiApiKey: value.GEMINI_API_KEY,
    geminiModel: value.GEMINI_MODEL,
    googleCloudProject: value.GOOGLE_CLOUD_PROJECT,
    documentAiLocation: value.DOCUMENT_AI_LOCATION,
    documentAiProcessorId: value.DOCUMENT_AI_PROCESSOR_ID,
    sessionSigningSecret: value.SESSION_SIGNING_SECRET,
    ipHashSalt: value.IP_HASH_SALT,
    maxPdfBytes: value.MAX_PDF_BYTES,
    maxPagesPerJob: value.MAX_PAGES_PER_JOB,
    dailyJobLimit: value.DAILY_JOB_LIMIT,
    dailyPageLimit: value.DAILY_PAGE_LIMIT,
    monthlyOcrPageCap: value.MONTHLY_OCR_PAGE_CAP,
    sessionTtlMinutes: value.SESSION_TTL_MINUTES,
    geminiTimeoutMs: value.GEMINI_TIMEOUT_MS,
    documentAiTimeoutMs: value.DOCUMENT_AI_TIMEOUT_MS,
    pdfRenderTimeoutMs: value.PDF_RENDER_TIMEOUT_MS,
    popplerBinPath: value.POPPLER_BIN_PATH,
    pdfFontRegularPath: value.PDF_FONT_REGULAR_PATH,
    firestoreDatabaseId: value.FIRESTORE_DATABASE_ID,
  };
}
