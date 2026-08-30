import {
  adminStatsSchema,
  progressEventSchema,
  publicConfigSchema,
  type AdminStats,
  type BoxSizeAdjustment,
  type Granularity,
  type LanguageCode,
  type ProgressEvent,
  type PublicConfig,
  type TranslationSession,
} from "../shared/contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code = "REQUEST_FAILED",
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      code?: string;
      error?: string | { code?: string; message?: string; requestId?: string };
      message?: string;
      requestId?: string;
    };
    const nested = typeof body.error === "object" ? body.error : undefined;
    return new ApiError(
      body.message ?? nested?.message ?? (typeof body.error === "string" ? body.error : undefined) ?? `Request failed (${response.status})`,
      body.code ?? nested?.code ?? "REQUEST_FAILED",
      body.requestId ?? nested?.requestId,
    );
  } catch {
    return new ApiError(`Request failed (${response.status})`);
  }
}

export async function loadPublicConfig(signal?: AbortSignal): Promise<PublicConfig> {
  const response = await fetch("/api/config", { signal });
  if (!response.ok) throw await readError(response);
  return publicConfigSchema.parse(await response.json());
}

export async function loadAdminStats(token: string, signal?: AbortSignal): Promise<AdminStats> {
  const response = await fetch("/api/admin/stats", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await readError(response);
  return adminStatsSchema.parse(await response.json());
}

function parseLine(line: string): ProgressEvent {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new ApiError("The server sent an unreadable progress update.", "INVALID_STREAM");
  }

  const parsed = progressEventSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError("The server sent an invalid progress update.", "INVALID_STREAM");
  }
  return parsed.data;
}

export async function streamTranslation(
  file: File,
  targetLanguage: LanguageCode,
  granularity: Granularity = "by-block",
  onEvent: (event: ProgressEvent) => void,
  signal?: AbortSignal,
  ownerAccessKey?: string,
): Promise<TranslationSession> {
  const form = new FormData();
  form.set("file", file);
  form.set("targetLanguage", targetLanguage);
  form.set("granularity", granularity);

  const response = await fetch("/api/translations", {
    method: "POST",
    body: form,
    headers: {
      Accept: "application/x-ndjson",
      ...(ownerAccessKey ? { Authorization: `Bearer ${ownerAccessKey}` } : {}),
    },
    signal,
  });

  if (!response.ok) throw await readError(response);
  if (!response.body) {
    throw new ApiError("Your browser could not read the progress stream.", "STREAM_UNAVAILABLE");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let session: TranslationSession | undefined;

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const event = parseLine(line);
    onEvent(event);
    if (event.type === "error") {
      throw new ApiError(event.message, event.code, event.requestId);
    }
    if (event.type === "ready") session = event.session;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    lines.forEach(consumeLine);
    if (done) break;
  }
  consumeLine(buffer);

  if (!session) {
    throw new ApiError("Processing ended before a translation was ready.", "INCOMPLETE_STREAM");
  }
  return session;
}

export async function exportTranslation(
  file: File,
  sessionToken: string,
  corrections: Record<string, string>,
  boxAdjustments: Record<string, BoxSizeAdjustment>,
  fontSizeAdjustments: Record<string, number>,
  excludedBlockIds: string[],
  signal?: AbortSignal,
): Promise<{ blob: Blob; fileName: string }> {
  const form = new FormData();
  form.set("file", file);
  form.set("sessionToken", sessionToken);
  form.set("corrections", JSON.stringify(corrections));
  form.set("boxAdjustments", JSON.stringify(boxAdjustments));
  form.set("fontSizeAdjustments", JSON.stringify(fontSizeAdjustments));
  form.set("excludedBlockIds", JSON.stringify(excludedBlockIds));

  const response = await fetch("/api/exports", {
    method: "POST",
    body: form,
    signal,
  });
  if (!response.ok) throw await readError(response);

  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const simpleName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let fileName = "translated.pdf";
  try {
    fileName = encodedName ? decodeURIComponent(encodedName) : (simpleName ?? fileName);
  } catch {
    fileName = simpleName ?? fileName;
  }

  return { blob: await response.blob(), fileName };
}
