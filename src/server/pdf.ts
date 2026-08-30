import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import sharp from "sharp";
import { AppError } from "./errors.js";
import type { AppConfig } from "./config.js";
import type { ExtractedPage } from "./providers.js";
import type { SessionPayload } from "./security.js";
import type { BoxSizeAdjustment, TranslationBlock } from "../shared/contracts.js";

type PdfJsDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getViewport(options: { scale: number }): { width: number; height: number };
    getTextContent(): Promise<{ items: unknown[] }>;
  }>;
};

type TextItem = {
  str: string;
  width: number;
  height: number;
  transform: number[];
  fontName?: string;
  hasEOL?: boolean;
};

function isTextItem(item: unknown): item is TextItem {
  const value = item as Partial<TextItem>;
  return typeof value?.str === "string" && typeof value.width === "number" && Array.isArray(value.transform);
}

export interface PdfInspection {
  pageCount: number;
  embeddedPages: ExtractedPage[];
  scannedPageNumbers: number[];
}

export async function inspectPdf(buffer: Buffer, config: AppConfig): Promise<PdfInspection> {
  if (buffer.length > config.maxPdfBytes) {
    throw new AppError("FILE_TOO_LARGE", "The PDF exceeds the 25 MB file limit.", 413);
  }
  const headerOffset = buffer.subarray(0, 1024).indexOf(Buffer.from("%PDF-"));
  if (headerOffset < 0) {
    throw new AppError("INVALID_PDF", "Choose a valid PDF file.");
  }

  let document: PdfJsDocument;
  let destroyDocument: (() => Promise<void>) | undefined;
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useWorkerFetch: false,
      verbosity: 0,
    } as Parameters<typeof pdfjs.getDocument>[0]);
    destroyDocument = () => loadingTask.destroy();
    document = await loadingTask.promise as unknown as PdfJsDocument;
  } catch (error) {
    const candidate = error as { name?: string; code?: number; message?: string };
    if (candidate.name === "PasswordException" || /password|encrypted/i.test(candidate.message ?? "")) {
      throw new AppError("ENCRYPTED_PDF", "Password-protected PDFs are not supported.");
    }
    throw new AppError("INVALID_PDF", "The PDF is damaged or could not be read.");
  }

  try {
    if (document.numPages < 1) throw new AppError("INVALID_PDF", "The PDF has no pages.");
    if (document.numPages > config.maxPagesPerJob) {
      throw new AppError("PAGE_LIMIT", `This PDF has ${document.numPages} pages. The limit is ${config.maxPagesPerJob}.`, 413);
    }
    const embeddedPages: ExtractedPage[] = [];
    const scannedPageNumbers: number[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const blocks = extractEmbeddedBlocks(pageNumber, viewport.width, viewport.height, content.items);
      const usefulCharacters = blocks.map((block) => block.originalText).join("").match(/[\p{L}\p{N}]/gu)?.length ?? 0;
      if (usefulCharacters >= 20) {
        embeddedPages.push({
          page: pageNumber,
          width: viewport.width,
          height: viewport.height,
          extraction: "embedded",
          blocks,
        });
      } else {
        scannedPageNumbers.push(pageNumber);
      }
    }
    return { pageCount: document.numPages, embeddedPages, scannedPageNumbers };
  } finally {
    await destroyDocument?.();
  }
}

function extractEmbeddedBlocks(page: number, pageWidth: number, pageHeight: number, items: unknown[]): TranslationBlock[] {
  const lines: Array<{
    x: number; y: number; width: number; height: number; text: string; fontSize: number; fontName: string;
  }> = [];
  for (const item of items) {
    if (!isTextItem(item) || !item.str.trim()) continue;
    const fontSize = Math.max(1, Math.hypot(item.transform[0] ?? 0, item.transform[1] ?? 0));
    const x = Math.max(0, item.transform[4] ?? 0);
    const height = Math.max(item.height || 0, fontSize);
    const y = Math.max(0, pageHeight - (item.transform[5] ?? 0) - height);
    const width = Math.max(1, item.width);
    const previous = lines.at(-1);
    const sameLine = previous && Math.abs(previous.y - y) <= Math.max(2, fontSize * 0.35);
    const gap = previous ? x - (previous.x + previous.width) : Number.POSITIVE_INFINITY;
    if (previous && sameLine && gap >= -fontSize && gap <= fontSize * 2.5 && !item.hasEOL) {
      const spacer = gap > fontSize * 0.2 && !previous.text.endsWith(" ") ? " " : "";
      previous.text += `${spacer}${item.str}`;
      previous.width = Math.max(previous.width, x + width - previous.x);
      previous.height = Math.max(previous.height, height);
    } else {
      lines.push({ x, y, width, height, text: item.str, fontSize, fontName: item.fontName ?? "" });
    }
  }

  return lines.slice(0, 1_500).map((line, index) => {
    const x = clamp(line.x / pageWidth, 0, 0.999);
    const y = clamp(line.y / pageHeight, 0, 0.999);
    const width = clamp(line.width / pageWidth, 0.001, 1 - x);
    const height = clamp(line.height / pageHeight, 0.001, 1 - y);
    return {
      id: `p${page}-e${index + 1}`,
      page,
      box: { x, y, width, height },
      originalText: line.text.trim(),
      translatedText: line.text.trim(),
      confidence: 1,
      needsReview: false,
      style: {
        fontSize: clamp(line.fontSize, 4, 200),
        color: "#111111",
        bold: /bold/i.test(line.fontName),
        italic: /italic|oblique/i.test(line.fontName),
        align: "left",
      },
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function popplerExecutable(config: AppConfig): string {
  const executable = process.platform === "win32" ? "pdftoppm.exe" : "pdftoppm";
  return config.popplerBinPath ? join(config.popplerBinPath, executable) : executable;
}

async function runPoppler(input: string, outputPrefix: string, pageCount: number, config: AppConfig): Promise<void> {
  const executable = popplerExecutable(config);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, ["-png", "-r", "144", "-f", "1", "-l", String(pageCount), input, outputPrefix], {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new AppError("EXPORT_FAILED", "PDF rendering timed out. Please try a smaller document.", 504));
    }, config.pdfRenderTimeoutMs);
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 2_000) stderr += chunk.toString("utf8");
    });
    child.once("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        reject(new AppError(
          "EXPORT_RENDERER_UNAVAILABLE",
          "PDF export needs Poppler (pdftoppm), which is not installed on this server.",
          503,
        ));
      } else {
        reject(new AppError("EXPORT_FAILED", "The translated PDF could not be rendered.", 500));
      }
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new AppError("EXPORT_FAILED", stderr.includes("Incorrect password")
        ? "Password-protected PDFs are not supported."
        : "The translated PDF could not be rendered.", 500));
    });
  });
}

async function findFont(config: AppConfig): Promise<string | undefined> {
  const candidates = [
    config.pdfFontRegularPath,
    process.env.PDF_FONT_REGULAR_PATH,
    process.platform === "win32" ? "C:\\Windows\\Fonts\\arial.ttf" : undefined,
    process.platform === "win32" ? "C:\\Windows\\Fonts\\segoeui.ttf" : undefined,
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ].filter((path): path is string => Boolean(path));
  for (const path of candidates) {
    try {
      await access(path);
      return path;
    } catch {
      // Try the next configured system font.
    }
  }
  return undefined;
}

type RawImage = { data: Buffer; width: number; height: number; channels: number };

async function rawImage(png: Buffer): Promise<RawImage> {
  const result = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: result.data, width: result.info.width, height: result.info.height, channels: result.info.channels };
}

function sampleBackground(image: RawImage, block: TranslationBlock): { r: number; g: number; b: number } {
  const left = clamp(Math.floor(block.box.x * image.width), 0, image.width - 1);
  const top = clamp(Math.floor(block.box.y * image.height), 0, image.height - 1);
  const right = clamp(Math.ceil((block.box.x + block.box.width) * image.width), left + 1, image.width);
  const bottom = clamp(Math.ceil((block.box.y + block.box.height) * image.height), top + 1, image.height);
  const samples: Array<[number, number, number]> = [];
  const add = (x: number, y: number) => {
    const offset = (y * image.width + x) * image.channels;
    samples.push([image.data[offset] ?? 255, image.data[offset + 1] ?? 255, image.data[offset + 2] ?? 255]);
  };
  const stepX = Math.max(1, Math.floor((right - left) / 20));
  const stepY = Math.max(1, Math.floor((bottom - top) / 10));
  for (let x = left; x < right; x += stepX) {
    add(x, Math.max(0, top - 2));
    add(x, Math.min(image.height - 1, bottom + 1));
  }
  for (let y = top; y < bottom; y += stepY) {
    add(Math.max(0, left - 2), y);
    add(Math.min(image.width - 1, right + 1), y);
  }
  if (!samples.length) return { r: 255, g: 255, b: 255 };
  const median = (channel: 0 | 1 | 2) => samples.map((sample) => sample[channel]).sort((a, b) => a - b)[Math.floor(samples.length / 2)] ?? 255;
  return { r: median(0), g: median(1), b: median(2) };
}

interface FittedText {
  lines: string[];
  size: number;
  lineHeight: number;
  ascent: number;
  topPadding: number;
  overflows: boolean;
}

function fontMetrics(font: PDFFont, size: number): { ascent: number; descent: number; lineHeight: number; topPadding: number; bottomPadding: number } {
  const ascent = font.heightAtSize(size, { descender: false });
  const totalHeight = font.heightAtSize(size, { descender: true });
  const descent = Math.max(size * 0.18, totalHeight - ascent);
  return {
    ascent,
    descent,
    lineHeight: Math.max(size * 1.24, totalHeight + size * 0.1),
    topPadding: Math.max(1.5, size * 0.14),
    bottomPadding: Math.max(1.75, size * 0.22),
  };
}

function textHeight(lineCount: number, metrics: ReturnType<typeof fontMetrics>): number {
  if (lineCount <= 1) {
    return metrics.ascent + metrics.descent;
  }
  return metrics.topPadding + metrics.ascent + (lineCount - 1) * metrics.lineHeight + metrics.descent + metrics.bottomPadding;
}

function fitText(text: string, font: PDFFont, requestedSize: number, width: number, height: number): FittedText | undefined {
  const initial = Math.max(3.5, requestedSize);
  const maxLineHeight = Math.max(height, initial * 1.15);
  for (let size = initial; size >= 3.5; size -= 0.25) {
    const lines = wrapText(text, font, size, width);
    const metrics = fontMetrics(font, size);
    if (textHeight(lines.length, metrics) <= maxLineHeight + 0.01) {
      return { lines, size, lineHeight: metrics.lineHeight, ascent: metrics.ascent, topPadding: metrics.topPadding, overflows: false };
    }
  }
  const lines = wrapText(text, font, 3.5, width);
  const metrics = fontMetrics(font, 3.5);
  return { lines, size: 3.5, lineHeight: metrics.lineHeight, ascent: metrics.ascent, topPadding: metrics.topPadding, overflows: true };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.replaceAll("\r", "").split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const hasSpaces = /\s/u.test(paragraph);
    const tokens = hasSpaces ? paragraph.split(/\s+/u) : Array.from(paragraph);
    let line = "";
    for (const token of tokens) {
      const candidate = line ? `${line}${hasSpaces ? " " : ""}${token}` : token;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = token;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function colorFromHex(value: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(value.slice(1, 3), 16) / 255,
    g: Number.parseInt(value.slice(3, 5), 16) / 255,
    b: Number.parseInt(value.slice(5, 7), 16) / 255,
  };
}

interface RenderedBlock {
  block: TranslationBlock;
  x: number;
  y: number;
  originalWidth: number;
  originalHeight: number;
  boxWidth: number;
  boxHeight: number;
  background: { r: number; g: number; b: number };
  fitted: FittedText;
}

export async function exportTranslatedPdf(
  source: Buffer,
  session: SessionPayload,
  corrections: Record<string, string>,
  boxAdjustments: Record<string, BoxSizeAdjustment>,
  fontSizeAdjustments: Record<string, number>,
  excludedBlockIds: string[],
  config: AppConfig,
): Promise<Buffer> {
  const tempDirectory = await mkdtemp(join(tmpdir(), "trangngu-"));
  try {
    const inputPath = join(tempDirectory, "input.pdf");
    const outputPrefix = join(tempDirectory, "page");
    await writeFile(inputPath, source, { flag: "wx" });
    await runPoppler(inputPath, outputPrefix, session.pageCount, config);
    const files = (await readdir(tempDirectory))
      .filter((name) => /^page-\d+\.png$/i.test(name))
      .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
    if (files.length !== session.pageCount) {
      throw new AppError("EXPORT_FAILED", "Not every PDF page could be rendered.", 500);
    }

    const output = await PDFDocument.create();
    output.setProducer("TrangNgu");
    output.setCreator("TrangNgu PDF Translator");
    output.registerFontkit(fontkit);
    const excludedBlocks = new Set(excludedBlockIds);
    const allText = session.pages.flatMap((page) => page.blocks
      .filter((block) => !excludedBlocks.has(block.id))
      .map((block) => corrections[block.id] ?? block.translatedText)).join("");
    const fontPath = await findFont(config);
    let font: PDFFont;
    if (fontPath) {
      font = await output.embedFont(await readFile(fontPath), { subset: true });
    } else if (Array.from(allText).every((character) => character.codePointAt(0)! <= 0x7f)) {
      font = await output.embedFont(StandardFonts.Helvetica);
    } else {
      throw new AppError(
        "EXPORT_FONT_UNAVAILABLE",
        "A Unicode PDF font is not installed. Configure PDF_FONT_REGULAR_PATH with a Noto Sans TTF file.",
        503,
      );
    }

    for (const pageInfo of session.pages.slice().sort((a, b) => a.page - b.page)) {
      const png = await readFile(join(tempDirectory, files[pageInfo.page - 1]!));
      const raw = await rawImage(png);
      const image = await output.embedPng(png);
      const page = output.addPage([pageInfo.width, pageInfo.height]);
      page.drawImage(image, { x: 0, y: 0, width: pageInfo.width, height: pageInfo.height });
      const renderedBlocks: RenderedBlock[] = [];
      for (const block of pageInfo.blocks) {
        if (excludedBlocks.has(block.id)) continue;
        const translatedText = corrections[block.id] ?? block.translatedText;
        const adjustedSize = boxAdjustments[block.id];
        const x = block.box.x * pageInfo.width;
        const top = block.box.y * pageInfo.height;
        const originalWidth = block.box.width * pageInfo.width;
        const originalHeight = block.box.height * pageInfo.height;
        const boxWidth = (adjustedSize?.width ?? block.box.width) * pageInfo.width;
        const boxHeight = (adjustedSize?.height ?? block.box.height) * pageInfo.height;
        const y = pageInfo.height - top - boxHeight;
        const background = sampleBackground(raw, block);
        const fitted = fitText(translatedText, font, fontSizeAdjustments[block.id] ?? block.style.fontSize, boxWidth, boxHeight);
        if (!fitted) throw new AppError("EXPORT_FAILED", "The translated PDF layout could not be calculated.", 500);
        renderedBlocks.push({ block, x, y, originalWidth, originalHeight, boxWidth, boxHeight, background, fitted });
      }

      // Clear every source region before painting translations. Drawing a later block's
      // background after an earlier translation can slice off descenders at the boundary.
      // Text is intentionally painted in a second pass so nearby user-resized boxes may overlap.
      for (const rendered of renderedBlocks) {
        const { block, x, originalWidth, originalHeight, background } = rendered;
        const originalY = pageInfo.height - block.box.y * pageInfo.height - originalHeight;
        const erasePaddingX = Math.max(2.5, Math.min(12, block.style.fontSize * 0.26));
        const erasePaddingY = Math.max(3, Math.min(12, block.style.fontSize * 0.42));
        const eraseX = Math.max(0, x - erasePaddingX);
        const eraseY = Math.max(0, originalY - erasePaddingY);
        page.drawRectangle({
          x: eraseX,
          y: eraseY,
          width: Math.min(pageInfo.width - eraseX, originalWidth + erasePaddingX * 2),
          height: Math.min(pageInfo.height - eraseY, originalHeight + erasePaddingY * 2),
          color: rgb(background.r / 255, background.g / 255, background.b / 255),
        });
      }
      for (const rendered of renderedBlocks) {
        const { block, x, y, boxWidth, boxHeight, fitted } = rendered;
        const foreground = colorFromHex(block.style.color);
        for (const [lineIndex, line] of fitted.lines.entries()) {
          const lineWidth = font.widthOfTextAtSize(line, fitted.size);
          const alignedX = block.style.align === "center"
            ? x + Math.max(0, (boxWidth - lineWidth) / 2)
            : block.style.align === "right" ? x + Math.max(0, boxWidth - lineWidth) : x;
          page.drawText(line, {
            x: alignedX,
            y: y + boxHeight - fitted.topPadding - fitted.ascent - lineIndex * fitted.lineHeight,
            size: fitted.size,
            font,
            color: rgb(foreground.r, foreground.g, foreground.b),
          });
        }
      }
    }
    return Buffer.from(await output.save({ useObjectStreams: true }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("EXPORT_FAILED", "The translated PDF could not be created.", 500);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
