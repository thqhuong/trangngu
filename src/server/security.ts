import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { AppError } from "./errors.js";
import type { Granularity, LanguageCode, TranslationBlock } from "../shared/contracts.js";

export interface SessionPayload {
  version: 1;
  requestId: string;
  fileName: string;
  documentHash: string;
  targetLanguage: LanguageCode;
  granularity?: Granularity;
  pageCount: number;
  preservedBlockCount?: number;
  expiresAt: string;
  pages: Array<{
    page: number;
    width: number;
    height: number;
    extraction: "embedded" | "document-ai";
    blocks: TranslationBlock[];
  }>;
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function createRuntimeSecret(): string {
  return randomBytes(48).toString("base64url");
}

export function hashIdentity(ip: string, salt: string): string {
  return createHmac("sha256", salt).update(ip).digest("hex");
}

export function secureStringEqual(received: string, expected: string): boolean {
  const receivedDigest = createHash("sha256").update(received).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}

export function signSession(payload: SessionPayload, secret: string): string {
  const compressed = deflateRawSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
  const body = compressed.toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySession(token: string, secret: string): SessionPayload {
  if (token.length > 8 * 1024 * 1024) {
    throw new AppError("INVALID_SESSION", "The translation session is invalid.");
  }
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) {
    throw new AppError("INVALID_SESSION", "The translation session is invalid.");
  }
  const expected = createHmac("sha256", secret).update(body).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    throw new AppError("INVALID_SESSION", "The translation session is invalid.");
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new AppError("INVALID_SESSION", "The translation session is invalid.");
  }

  let payload: SessionPayload;
  try {
    const decoded = inflateRawSync(Buffer.from(body, "base64url"), {
      maxOutputLength: 32 * 1024 * 1024,
    });
    payload = JSON.parse(decoded.toString("utf8")) as SessionPayload;
  } catch {
    throw new AppError("INVALID_SESSION", "The translation session is invalid.");
  }
  if (payload.version !== 1 || !payload.documentHash || !Array.isArray(payload.pages)) {
    throw new AppError("INVALID_SESSION", "The translation session is invalid.");
  }
  if (!Number.isFinite(Date.parse(payload.expiresAt))) {
    throw new AppError("INVALID_SESSION", "The translation session is invalid.");
  }
  if (Date.parse(payload.expiresAt) <= Date.now()) {
    throw new AppError("TOKEN_EXPIRED", "This review session has expired. Please translate the PDF again.");
  }
  return payload;
}

export function safeFileName(name: string): string {
  const leaf = name.replaceAll("\\", "/").split("/").pop() ?? "document.pdf";
  const withoutControls = Array.from(leaf, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f ? "_" : character;
  }).join("");
  const cleaned = withoutControls.replace(/[<>:"|?*]/g, "_").trim();
  return (cleaned || "document.pdf").slice(0, 200);
}
