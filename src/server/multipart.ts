import type { FastifyRequest } from "fastify";
import { AppError } from "./errors.js";
import { safeFileName } from "./security.js";

export interface MultipartPayload {
  file: Buffer;
  fileName: string;
  fields: Record<string, string>;
}

export async function readMultipart(request: FastifyRequest, maxPdfBytes: number): Promise<MultipartPayload> {
  if (!request.isMultipart()) {
    throw new AppError("INVALID_PDF", "Send the PDF as multipart form data.");
  }
  let file: Buffer | undefined;
  let fileName = "document.pdf";
  const fields: Record<string, string> = Object.create(null) as Record<string, string>;
  try {
    for await (const part of request.parts({
      limits: { files: 1, fileSize: maxPdfBytes, fields: 8, fieldSize: 8 * 1024 * 1024 },
    })) {
      if (part.type === "file") {
        if (file) throw new AppError("INVALID_PDF", "Upload one PDF at a time.");
        fileName = safeFileName(part.filename || "document.pdf");
        file = await part.toBuffer();
        if (part.file.truncated || file.length > maxPdfBytes) {
          throw new AppError("FILE_TOO_LARGE", "The PDF exceeds the 25 MB file limit.", 413);
        }
      } else if (typeof part.value === "string") {
        fields[part.fieldname] = part.value;
      }
    }
  } catch (error) {
    const candidate = error as { code?: string; name?: string };
    if (candidate.code === "FST_REQ_FILE_TOO_LARGE" || candidate.name === "RequestFileTooLargeError") {
      throw new AppError("FILE_TOO_LARGE", "The PDF exceeds the 25 MB file limit.", 413);
    }
    throw error;
  }
  if (!file?.length) throw new AppError("INVALID_PDF", "Choose a PDF to continue.");
  return { file, fileName, fields };
}
