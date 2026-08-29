import { randomUUID } from "node:crypto";
import { boxAdjustmentMapSchema, correctionMapSchema, languageCodeSchema, translationSessionSchema, type ProgressEvent, type TranslationSession } from "../shared/contracts.js";
import type { AppConfig } from "./config.js";
import { AppError } from "./errors.js";
import { exportTranslatedPdf, inspectPdf } from "./pdf.js";
import { createOcrProvider, createTranslationProvider, type OcrProvider, type TranslationProvider } from "./providers.js";
import { createQuotaStore, type QuotaStore } from "./quota.js";
import { createRuntimeSecret, hashIdentity, sha256, signSession, verifySession, type SessionPayload } from "./security.js";
import { createTelemetryStore, type TelemetryStore } from "./telemetry.js";

export interface BackendServices {
  quota: QuotaStore;
  telemetry: TelemetryStore;
  translator?: TranslationProvider;
  ocr?: OcrProvider;
  now: () => Date;
  sessionSecret?: string;
  ipSalt?: string;
}

export function createBackendServices(config: AppConfig, overrides: Partial<BackendServices> = {}): BackendServices {
  const allowRuntimeSecrets = config.nodeEnv !== "production";
  return {
    quota: overrides.quota ?? createQuotaStore(config),
    telemetry: overrides.telemetry ?? createTelemetryStore(config),
    translator: overrides.translator,
    ocr: overrides.ocr,
    now: overrides.now ?? (() => new Date()),
    sessionSecret: overrides.sessionSecret ?? config.sessionSigningSecret ?? (allowRuntimeSecrets ? createRuntimeSecret() : undefined),
    ipSalt: overrides.ipSalt ?? config.ipHashSalt ?? (allowRuntimeSecrets ? createRuntimeSecret() : undefined),
  };
}

export interface TranslationInput {
  file: Buffer;
  fileName: string;
  targetLanguage: string;
  requesterIp: string;
  requestId?: string;
}

export async function translatePdf(
  input: TranslationInput,
  config: AppConfig,
  services: BackendServices,
  emit: (event: ProgressEvent) => void,
): Promise<TranslationSession> {
  const requestId = input.requestId ?? randomUUID();
  const target = languageCodeSchema.safeParse(input.targetLanguage);
  if (!target.success) throw new AppError("UNSUPPORTED_LANGUAGE", "Choose one of the supported target languages.");
  if (!services.sessionSecret || !services.ipSalt) {
    throw new AppError("CONFIGURATION_ERROR", "Secure session handling is not configured on this service.", 503);
  }

  emit({ type: "progress", stage: "validating", message: "Checking PDF and usage limits...", progress: 5 });
  const inspection = await inspectPdf(input.file, config);
  const identity = hashIdentity(input.requesterIp, services.ipSalt);
  await services.quota.reserveDaily(identity, inspection.pageCount, services.now());

  emit({ type: "progress", stage: "extracting", message: inspection.scannedPageNumbers.length
    ? "Reading embedded text and recognizing scanned pages..."
    : "Reading the document's text layer...", progress: 25 });
  const pages = [...inspection.embeddedPages];
  if (inspection.scannedPageNumbers.length) {
    await services.quota.reserveOcr(inspection.scannedPageNumbers.length, services.now());
    const ocr = services.ocr ?? createOcrProvider(config);
    const recognizedPages = await ocr.extract(input.file, inspection.scannedPageNumbers);
    const recognizedNumbers = new Set(recognizedPages.map((page) => page.page));
    const missing = inspection.scannedPageNumbers.filter((page) => !recognizedNumbers.has(page));
    if (missing.length) {
      throw new AppError("OCR_UNAVAILABLE", "One or more scanned pages could not be recognized. Please improve the scan and try again.", 502);
    }
    pages.push(...recognizedPages);
  }
  pages.sort((a, b) => a.page - b.page);
  const blocks = pages.flatMap((page) => page.blocks);
  if (!blocks.length) {
    throw new AppError("INVALID_PDF", "No readable text was found in this PDF.");
  }

  emit({ type: "progress", stage: "translating", message: "Translating document blocks with Gemini...", progress: 55 });
  const translator = services.translator ?? createTranslationProvider(config);
  const translations = await translator.translate(blocks, target.data);
  const usingDevelopmentFallback = !services.translator && !config.geminiApiKey && config.nodeEnv !== "production";
  for (const block of blocks) {
    const translated = translations.get(block.id)?.trim();
    if (!translated) throw new AppError("UNSAFE_RESPONSE", "The translation response was incomplete. Please try again.", 502);
    block.translatedText = translated;
    const expansion = translated.length / Math.max(1, block.originalText.length);
    if (usingDevelopmentFallback || expansion > 1.8) {
      block.needsReview = true;
      block.reviewReason = usingDevelopmentFallback
        ? "Development preview only - configure GEMINI_API_KEY for real translation"
        : "Translation may need a shorter phrasing to fit the original layout";
    }
  }

  emit({ type: "progress", stage: "preparing", message: "Preparing the layout review...", progress: 85 });
  const expiresAt = new Date(services.now().getTime() + config.sessionTtlMinutes * 60_000).toISOString();
  const payload: SessionPayload = {
    version: 1,
    requestId,
    fileName: input.fileName,
    documentHash: sha256(input.file),
    targetLanguage: target.data,
    pageCount: inspection.pageCount,
    expiresAt,
    pages,
  };
  const sessionToken = signSession(payload, services.sessionSecret);
  return translationSessionSchema.parse({ ...payload, sessionToken });
}

export interface ExportInput {
  file: Buffer;
  sessionToken: string;
  corrections: unknown;
  boxAdjustments?: unknown;
}

export async function exportPdf(
  input: ExportInput,
  config: AppConfig,
  services: BackendServices,
): Promise<{ buffer: Buffer; session: SessionPayload }> {
  if (!services.sessionSecret) {
    throw new AppError("CONFIGURATION_ERROR", "Secure session handling is not configured on this service.", 503);
  }
  if (input.file.length > config.maxPdfBytes) throw new AppError("FILE_TOO_LARGE", "The PDF exceeds the 25 MB file limit.", 413);
  const session = verifySession(input.sessionToken, services.sessionSecret);
  if (sha256(input.file) !== session.documentHash) {
    throw new AppError("DOCUMENT_MISMATCH", "Upload the same PDF that was used for this translation.");
  }
  const corrections = correctionMapSchema.safeParse(input.corrections);
  const boxAdjustments = boxAdjustmentMapSchema.safeParse(input.boxAdjustments ?? {});
  if (!corrections.success || !boxAdjustments.success) {
    throw new AppError("INVALID_CORRECTIONS", "One or more text corrections or box sizes are invalid.");
  }
  const knownBlocks = new Map(session.pages.flatMap((page) => page.blocks.map((block) => [block.id, block] as const)));
  const entries = Object.entries(corrections.data);
  const adjustmentEntries = Object.entries(boxAdjustments.data);
  const invalidAdjustment = adjustmentEntries.some(([id, size]) => {
    const block = knownBlocks.get(id);
    return !block || block.box.x + size.width > 1.000_001 || block.box.y + size.height > 1.000_001;
  });
  if (entries.some(([id]) => !knownBlocks.has(id)) || invalidAdjustment || entries.reduce((total, [, text]) => total + text.length, 0) > 250_000) {
    throw new AppError("INVALID_CORRECTIONS", "One or more text corrections or box sizes do not belong to this document or fit on its page.");
  }
  const buffer = await exportTranslatedPdf(input.file, session, corrections.data, boxAdjustments.data, config);
  return { buffer, session };
}
