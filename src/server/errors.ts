export type ErrorCode =
  | "INVALID_PDF"
  | "FILE_TOO_LARGE"
  | "PAGE_LIMIT"
  | "ENCRYPTED_PDF"
  | "UNSUPPORTED_LANGUAGE"
  | "DAILY_JOB_LIMIT"
  | "DAILY_PAGE_LIMIT"
  | "OCR_CAP_REACHED"
  | "OCR_UNAVAILABLE"
  | "OCR_TIMEOUT"
  | "MODEL_UNAVAILABLE"
  | "MODEL_QUOTA"
  | "MODEL_TIMEOUT"
  | "UNSAFE_RESPONSE"
  | "TOKEN_EXPIRED"
  | "INVALID_SESSION"
  | "DOCUMENT_MISMATCH"
  | "INVALID_CORRECTIONS"
  | "EXPORT_RENDERER_UNAVAILABLE"
  | "EXPORT_FONT_UNAVAILABLE"
  | "EXPORT_FAILED"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError("INTERNAL_ERROR", "The request could not be completed.", 500);
}
