import {
  AlertCircle, AlertTriangle, ArrowRight, Check, ChevronLeft, ChevronRight, CircleCheck,
  Columns2, Download, Eye, FileText, Globe2, Languages, LayoutTemplate, LoaderCircle,
  LockKeyhole, EyeOff, Pencil, RefreshCw, ScanText, ShieldCheck, Sparkles, Type, Undo2, UploadCloud, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from "react";
import type { BoxSizeAdjustment, LanguageCode, ProgressEvent, TranslationBlock, TranslationSession } from "../shared/contracts";
import { exportTranslation, loadPublicConfig, streamTranslation } from "./api";
import { AdminDashboard } from "./AdminDashboard";
import { copy, DEFAULT_CONFIG, formatBytes, getFriendlyError, type Locale } from "./i18n";
import { PdfCanvas } from "./PdfCanvas";
import { SampleComparison } from "./SampleComparison";
import { usePdf } from "./usePdf";

type Phase = "upload" | "processing" | "review" | "error";
type ProgressStage = "validating" | "extracting" | "translating" | "preparing";
const stageOrder: ProgressStage[] = ["validating", "extracting", "translating", "preparing"];

function blockText(block: TranslationBlock, corrections: Record<string, string>) {
  return corrections[block.id] ?? block.translatedText;
}

function blockSize(block: TranslationBlock, adjustments: Record<string, BoxSizeAdjustment>): BoxSizeAdjustment {
  return adjustments[block.id] ?? { width: block.box.width, height: block.box.height };
}

function blockFontSize(block: TranslationBlock, adjustments: Record<string, number>): number {
  return adjustments[block.id] ?? block.style.fontSize;
}

type ReviewStatus = { warning: boolean; reason?: string };

let layoutCanvas: HTMLCanvasElement | undefined;

function estimateWrappedLines(text: string, fontSize: number, width: number): number {
  if (!layoutCanvas) layoutCanvas = document.createElement("canvas");
  const context = layoutCanvas.getContext("2d");
  if (!context) return Math.max(1, Math.ceil(text.length * fontSize * 0.5 / Math.max(1, width)));
  context.font = `${fontSize}px Arial, sans-serif`;
  const lines: string[] = [];
  for (const paragraph of text.replaceAll("\r", "").split("\n")) {
    if (!paragraph) { lines.push(""); continue; }
    const hasSpaces = /\s/u.test(paragraph);
    const tokens = hasSpaces ? paragraph.split(/\s+/u) : Array.from(paragraph);
    let line = "";
    for (const token of tokens) {
      const candidate = line ? `${line}${hasSpaces ? " " : ""}${token}` : token;
      if (context.measureText(candidate).width <= width || !line) line = candidate;
      else { lines.push(line); line = token; }
    }
    if (line) lines.push(line);
  }
  return Math.max(1, lines.length);
}

function hasLayoutOverflow(block: TranslationBlock, pageWidth: number, pageHeight: number, text: string, size: BoxSizeAdjustment, fontSize: number): boolean {
  const lines = estimateWrappedLines(text, fontSize, Math.max(1, size.width * pageWidth - 4));
  const requiredHeight = Math.max(1.5, fontSize * 0.14) + fontSize * 0.9 + Math.max(0, lines - 1) * fontSize * 1.24 + fontSize * 0.4 + Math.max(1.75, fontSize * 0.22);
  return requiredHeight > size.height * pageHeight + 0.01;
}

function boxesOverlap(first: TranslationBlock, second: TranslationBlock, adjustments: Record<string, BoxSizeAdjustment>): boolean {
  const firstSize = blockSize(first, adjustments);
  const secondSize = blockSize(second, adjustments);
  return first.box.x < second.box.x + secondSize.width - 0.002 && first.box.x + firstSize.width > second.box.x + 0.002 &&
    first.box.y < second.box.y + secondSize.height - 0.002 && first.box.y + firstSize.height > second.box.y + 0.002;
}

function isStaticConfidenceWarning(block: TranslationBlock): boolean {
  return block.reviewReason === "Low OCR confidence";
}

function TranslationOverlay({ blocks, corrections, adjustments, fontSizes, excludedBlocks, reviewStatuses, activeId, onSelect, onResize }: {
  blocks: TranslationBlock[]; corrections: Record<string, string>; adjustments: Record<string, BoxSizeAdjustment>;
  fontSizes: Record<string, number>; excludedBlocks: Record<string, true>;
  reviewStatuses: Record<string, ReviewStatus>;
  activeId: string | null; onSelect: (id: string) => void; onResize: (block: TranslationBlock, size: BoxSizeAdjustment) => void;
}) {
  return <div className="translation-overlay" aria-hidden="true">{blocks.filter((block) => !excludedBlocks[block.id]).map((block) => {
    const size = blockSize(block, adjustments);
    const style = {
      left: `${block.box.x * 100}%`, top: `${block.box.y * 100}%`, width: `${size.width * 100}%`, height: `${size.height * 100}%`,
      color: block.style.color, fontSize: `${Math.max(4, Math.min(28, blockFontSize(block, fontSizes) * 0.8))}px`,
      fontWeight: block.style.bold ? 700 : 400, fontStyle: block.style.italic ? "italic" : "normal", textAlign: block.style.align,
    } satisfies CSSProperties;
    const resize = (event: PointerEvent<HTMLSpanElement>) => {
      const overlay = event.currentTarget.closest(".translation-overlay");
      if (!(overlay instanceof HTMLElement)) return;
      const bounds = overlay.getBoundingClientRect();
      const minimumWidth = Math.min(0.02, 1 - block.box.x);
      const minimumHeight = Math.min(0.02, 1 - block.box.y);
      onResize(block, {
        width: Math.max(minimumWidth, Math.min(1 - block.box.x, (event.clientX - bounds.left) / bounds.width - block.box.x)),
        height: Math.max(minimumHeight, Math.min(1 - block.box.y, (event.clientY - bounds.top) / bounds.height - block.box.y)),
      });
    };
    return <div key={block.id}>
      <button type="button" tabIndex={-1} style={style} onClick={() => onSelect(block.id)}
      className={`translated-block${reviewStatuses[block.id]?.warning ? " needs-review" : ""}${activeId === block.id ? " is-active" : ""}`}>
      {blockText(block, corrections)}
      </button>
      {activeId === block.id && <div className="block-resize-frame" style={style}>
        <span className="block-resize-handle" onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); resize(event); }}
          onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(event); }} />
      </div>}
    </div>;
  })}</div>;
}

function PagePreview({ document, pageNumber, blocks, corrections, adjustments, fontSizes, excludedBlocks, reviewStatuses, activeId, onSelect, onResize, translated = false, label }: {
  document: ReturnType<typeof usePdf>["document"]; pageNumber: number; blocks: TranslationBlock[]; corrections: Record<string, string>;
  adjustments: Record<string, BoxSizeAdjustment>; fontSizes: Record<string, number>; excludedBlocks: Record<string, true>;
  reviewStatuses: Record<string, ReviewStatus>;
  activeId: string | null; onSelect: (id: string) => void;
  onResize: (block: TranslationBlock, size: BoxSizeAdjustment) => void; translated?: boolean; label: string;
}) {
  return <div className={`pdf-sheet${translated ? " is-translated" : ""}`}>
    <PdfCanvas document={document} pageNumber={pageNumber} label={label} />
    {translated && <TranslationOverlay blocks={blocks} corrections={corrections} adjustments={adjustments} fontSizes={fontSizes} excludedBlocks={excludedBlocks} reviewStatuses={reviewStatuses} activeId={activeId} onSelect={onSelect} onResize={onResize} />}
  </div>;
}

function TranslatorApp({ ownerAccessKey, onDisableOwnerMode }: { ownerAccessKey: string; onDisableOwnerMode: () => void }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [phase, setPhase] = useState<Phase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>("vi");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState({ stage: "validating" as ProgressStage, value: 0 });
  const [session, setSession] = useState<TranslationSession | null>(null);
  const [requestError, setRequestError] = useState<{ code: string; message: string; requestId?: string } | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [boxAdjustments, setBoxAdjustments] = useState<Record<string, BoxSizeAdjustment>>({});
  const [fontSizeAdjustments, setFontSizeAdjustments] = useState<Record<string, number>>({});
  const [excludedBlocks, setExcludedBlocks] = useState<Record<string, true>>({});
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "reveal">("split");
  const [reveal, setReveal] = useState(54);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const pdf = usePdf(file);
  const t = copy[locale];

  useEffect(() => {
    const controller = new AbortController();
    void loadPublicConfig(controller.signal).then(setConfig).catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (pdf.error && file) setFileError(locale === "vi" ? "Không thể mở PDF này. Tệp có thể bị hỏng hoặc được mã hóa." : "This PDF could not be opened. It may be damaged or password protected.");
    else if (pdf.document && pdf.document.numPages > config.maxPagesPerJob) setFileError(locale === "vi"
      ? `PDF có ${pdf.document.numPages} trang; giới hạn mỗi lượt là ${config.maxPagesPerJob} trang.`
      : `This PDF has ${pdf.document.numPages} pages; the per-job limit is ${config.maxPagesPerJob}.`);
    else if (pdf.document) setFileError(null);
  }, [config.maxPagesPerJob, file, locale, pdf.document, pdf.error]);

  const reviewStatuses = useMemo<Record<string, ReviewStatus>>(() => {
    if (!session) return {};
    const statuses: Record<string, ReviewStatus> = {};
    for (const page of session.pages) {
      const visibleBlocks = page.blocks.filter((block) => !excludedBlocks[block.id]);
      for (const block of visibleBlocks) {
        const size = blockSize(block, boxAdjustments);
        const textOverflows = hasLayoutOverflow(block, page.width, page.height, blockText(block, corrections), size, blockFontSize(block, fontSizeAdjustments));
        const overlaps = visibleBlocks.some((other) => other.id !== block.id && boxesOverlap(block, other, boxAdjustments));
        if (textOverflows || overlaps) {
          statuses[block.id] = {
            warning: true,
            reason: textOverflows ? t.layoutOverflowWarning : t.layoutOverlapWarning,
          };
        } else if (isStaticConfidenceWarning(block)) {
          statuses[block.id] = { warning: true, reason: block.reviewReason || t.lowConfidence };
        } else {
          statuses[block.id] = { warning: false };
        }
      }
    }
    return statuses;
  }, [boxAdjustments, corrections, excludedBlocks, fontSizeAdjustments, session, t.layoutOverlapWarning, t.layoutOverflowWarning, t.lowConfidence]);
  const currentPage = session?.pages.find((page) => page.page === pageNumber) ?? null;
  const pageBlocks = useMemo(() => currentPage ? [...currentPage.blocks].sort((a, b) => Number(Boolean(reviewStatuses[b.id]?.warning)) - Number(Boolean(reviewStatuses[a.id]?.warning))) : [], [currentPage, reviewStatuses]);
  const flaggedCount = Object.values(reviewStatuses).filter((status) => status.warning).length;
  const editedCount = new Set([...Object.keys(corrections), ...Object.keys(boxAdjustments), ...Object.keys(fontSizeAdjustments), ...Object.keys(excludedBlocks)]).size;
  const keptOriginalCount = Object.keys(excludedBlocks).length;

  useEffect(() => {
    const blocks = session?.pages.find((page) => page.page === pageNumber)?.blocks ?? [];
    setActiveBlockId((blocks.find((block) => reviewStatuses[block.id]?.warning && !excludedBlocks[block.id]) ?? blocks.find((block) => !excludedBlocks[block.id]))?.id ?? null);
  }, [pageNumber, session, excludedBlocks, reviewStatuses]);

  const chooseFile = (nextFile?: File) => {
    if (!nextFile) return;
    const isPdf = nextFile.type === "application/pdf" || nextFile.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) { setFile(null); setFileError(locale === "vi" ? "Vui lòng chọn tệp PDF." : "Please choose a PDF file."); return; }
    if (nextFile.size > config.maxPdfBytes) {
      setFile(null); setFileError(locale === "vi" ? `Tệp lớn hơn giới hạn ${formatBytes(config.maxPdfBytes, locale)}.` : `The file is larger than the ${formatBytes(config.maxPdfBytes, locale)} limit.`); return;
    }
    setFileError(null); setFile(nextFile); setExportNotice(null);
  };
  const onDrop = (event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); };
  const reset = () => {
    controllerRef.current?.abort(); controllerRef.current = null; setPhase("upload"); setFile(null); setFileError(null);
    setSession(null); setCorrections({}); setBoxAdjustments({}); setFontSizeAdjustments({}); setExcludedBlocks({}); setRequestError(null); setPageNumber(1); setExportNotice(null); setExporting(false);
  };
  const start = async () => {
    if (!file || !pdf.document || pdf.loading || fileError || phase === "processing") return;
    const controller = new AbortController(); controllerRef.current = controller; setPhase("processing"); setRequestError(null);
    setProgress({ stage: "validating", value: 2 });
    try {
      const ready = await streamTranslation(file, targetLanguage, (event: ProgressEvent) => {
        if (event.type === "progress") setProgress({ stage: event.stage, value: event.progress });
      }, controller.signal, ownerAccessKey);
      setSession(ready); setCorrections({}); setBoxAdjustments({}); setFontSizeAdjustments({}); setExcludedBlocks({}); setPageNumber(1); setPhase("review");
    } catch (error) {
      if (controller.signal.aborted) { setPhase("upload"); return; }
      setRequestError(getFriendlyError(error, locale)); setPhase("error");
    } finally { if (controllerRef.current === controller) controllerRef.current = null; }
  };
  const cancel = () => { controllerRef.current?.abort(); controllerRef.current = null; setPhase("upload"); };
  const updateCorrection = (block: TranslationBlock, value: string) => setCorrections((current) => {
    if (value !== block.translatedText) return { ...current, [block.id]: value };
    const next = { ...current }; delete next[block.id]; return next;
  });
  const updateBoxSize = (block: TranslationBlock, nextSize: BoxSizeAdjustment) => setBoxAdjustments((current) => {
    const width = Math.max(0.001, Math.min(1 - block.box.x, nextSize.width));
    const height = Math.max(0.001, Math.min(1 - block.box.y, nextSize.height));
    if (Math.abs(width - block.box.width) < 0.000_5 && Math.abs(height - block.box.height) < 0.000_5) {
      const next = { ...current }; delete next[block.id]; return next;
    }
    return { ...current, [block.id]: { width, height } };
  });
  const restoreBoxSize = (block: TranslationBlock) => setBoxAdjustments((current) => {
    const next = { ...current }; delete next[block.id]; return next;
  });
  const updateFontSize = (block: TranslationBlock, value: number) => setFontSizeAdjustments((current) => {
    const fontSize = Math.max(3.5, Math.min(200, value));
    if (Math.abs(fontSize - block.style.fontSize) < 0.01) {
      const next = { ...current }; delete next[block.id]; return next;
    }
    return { ...current, [block.id]: fontSize };
  });
  const keepOriginal = (block: TranslationBlock) => {
    setExcludedBlocks((current) => current[block.id]
      ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== block.id)) as Record<string, true>
      : { ...current, [block.id]: true });
    setActiveBlockId((current) => current === block.id ? null : current);
  };
  const download = async () => {
    if (!file || !session || exporting) return;
    setExporting(true); setExportNotice(null);
    try {
      const result = await exportTranslation(file, session.sessionToken, corrections, boxAdjustments, fontSizeAdjustments, Object.keys(excludedBlocks));
      const url = URL.createObjectURL(result.blob); const link = document.createElement("a");
      link.href = url; link.download = result.fileName; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000); setExportNotice({ kind: "success", text: t.downloadReady });
    } catch (error) { setExportNotice({ kind: "error", text: `${t.downloadError} ${getFriendlyError(error, locale).message}` }); }
    finally { setExporting(false); }
  };
  const languageLabel = (code: LanguageCode) => {
    const option = config.languages.find((language) => language.code === code);
    return option ? (locale === "vi" ? option.nativeLabel : option.label) : code;
  };

  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="#top" aria-label="TrangNgữ home" onClick={(event) => { event.preventDefault(); if (phase !== "processing") reset(); }}>
        <span className="brand-mark" aria-hidden="true"><Languages size={22} strokeWidth={2.2} /></span><span>TrangNgữ</span><span className="brand-beta">BETA</span>
      </a>
      <div className="header-actions"><span className="header-privacy"><LockKeyhole size={15} /> {t.footerPrivacy}</span>
        {ownerAccessKey && <button type="button" className="owner-mode-badge" onClick={onDisableOwnerMode} title={t.disableOwnerMode}>
          <ShieldCheck size={14} /> {t.ownerMode}
        </button>}
        <div className="locale-toggle" role="group" aria-label="Interface language">
          <button type="button" className={locale === "en" ? "is-active" : ""} onClick={() => setLocale("en")} aria-pressed={locale === "en"}>EN</button>
          <button type="button" className={locale === "vi" ? "is-active" : ""} onClick={() => setLocale("vi")} aria-pressed={locale === "vi"}>VI</button>
        </div>
      </div>
    </header>

    <main id="top">
      {phase === "upload" && <>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy"><div className="eyebrow"><Sparkles size={16} /> {t.badge}</div>
            <h1 id="hero-title"><span>{t.heroTitleA}</span> {t.heroTitleB}</h1><p className="hero-lede">{t.heroBody}</p>
            <div className="trust-row"><span><Check size={16} /> {t.signUp}</span><span><Check size={16} /> {t.deleted}</span><span><Check size={16} /> {t.worksScans}</span></div>
          </div>
          <div className="upload-workbench"><div className="upload-card">
            {!file ? <label className={`drop-zone${dragging ? " is-dragging" : ""}${fileError ? " has-error" : ""}`}
              onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => chooseFile(e.target.files?.[0])} />
              <span className="upload-icon"><UploadCloud size={30} /></span><strong>{t.uploadTitle}</strong><span>{t.uploadHint}</span>
              <span className="choose-file-button">{t.chooseFile}</span><span className="file-rules"><b>{t.pdfOnly}</b><i />{t.fileLimit}<i />{t.pageLimit}</span>
            </label> : <div className="selected-file"><div className="file-icon"><FileText size={27} /></div><div className="file-copy">
              <span>{pdf.loading ? t.checking : t.selected}</span><strong title={file.name}>{file.name}</strong>
              <small>{formatBytes(file.size, locale)}{pdf.document ? ` · ${pdf.document.numPages} ${t.pages}` : ""}</small></div>
              {pdf.loading ? <LoaderCircle className="spin" size={20} /> : <button type="button" className="icon-button" onClick={() => { setFile(null); setFileError(null); }} aria-label={t.remove}><X size={20} /></button>}
            </div>}
            {fileError && <div className="inline-error" role="alert"><AlertCircle size={17} /><span>{fileError}</span></div>}
            <div className="translation-controls"><label htmlFor="target-language">{t.targetLabel}</label>
              <div className="select-wrap"><Globe2 size={18} /><select id="target-language" value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value as LanguageCode)}>
                {config.languages.map((option) => <option key={option.code} value={option.code}>{option.nativeLabel} · {option.label}</option>)}</select></div>
              <button className="primary-button" type="button" disabled={!file || pdf.loading || !pdf.document || Boolean(fileError)} onClick={() => void start()}>
                <span>{pdf.loading ? t.preparingUpload : t.translate}</span>{pdf.loading ? <LoaderCircle className="spin" size={19} /> : <ArrowRight size={19} />}
              </button><span className={`usage-limit${ownerAccessKey ? " owner-active" : ""}`}><ShieldCheck size={15} /> {ownerAccessKey ? t.ownerLimitBypass : t.dailyLimit}</span>
            </div>
          </div><aside className="privacy-note"><ShieldCheck size={21} /><div><strong>{t.privacyTitle}</strong><p>{t.privacyBody}</p><b>{t.privacyWarning}</b></div></aside></div>
        </section>
        <section className="how-it-works" aria-labelledby="how-title"><div className="section-heading"><span>01 — 03</span><h2 id="how-title">{t.howTitle}</h2></div>
          <div className="steps"><article><span className="step-number">01</span><ScanText size={25} /><h3>{t.stepOne}</h3><p>{t.stepOneBody}</p></article>
            <article><span className="step-number">02</span><Sparkles size={25} /><h3>{t.stepTwo}</h3><p>{t.stepTwoBody}</p></article>
            <article><span className="step-number">03</span><LayoutTemplate size={25} /><h3>{t.stepThree}</h3><p>{t.stepThreeBody}</p></article></div>
        </section>
        <SampleComparison locale={locale} />
      </>}

      {phase === "processing" && <section className="state-page processing-page" aria-labelledby="processing-title"><div className="state-card">
        <div className="processing-orbit" aria-hidden="true"><Languages size={30} /><span /></div><div className="eyebrow"><LoaderCircle className="spin" size={15} /> {t.processingEyebrow}</div>
        <h1 id="processing-title">{t.processingTitle}</h1><p>{t.processingBody}</p>
        <div className="progress-meter" role="progressbar" aria-label={t[progress.stage]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.value}><div style={{ width: `${progress.value}%` }} /></div>
        <div className="progress-label"><strong>{t[progress.stage]}</strong><span>{Math.round(progress.value)}%</span></div>
        <ol className="progress-steps">{stageOrder.map((stage, index) => { const current = stageOrder.indexOf(progress.stage); const complete = index < current || progress.value === 100; return <li key={stage} className={`${complete ? "is-complete" : ""}${index === current && !complete ? " is-active" : ""}`}><span>{complete ? <Check size={14} /> : index + 1}</span>{t[stage]}</li>; })}</ol>
        <div className="processing-file"><FileText size={18} /><span>{file?.name}</span><b>{languageLabel(targetLanguage)}</b></div><button type="button" className="text-button" onClick={cancel}>{t.cancel}</button>
      </div></section>}

      {phase === "error" && requestError && <section className="state-page error-page" aria-labelledby="error-title"><div className="state-card">
        <span className="error-icon"><AlertTriangle size={31} /></span><span className="error-code">{requestError.code}</span><h1 id="error-title">{t.errorTitle}</h1><p>{requestError.message}</p>
        {requestError.requestId && <small>{t.requestId}: <code>{requestError.requestId}</code></small>}
        <div className="state-actions"><button type="button" className="primary-button" onClick={() => void start()}><RefreshCw size={18} /> {t.tryAgain}</button><button type="button" className="secondary-button" onClick={reset}>{t.chooseAnother}</button></div>
      </div></section>}

      {phase === "review" && session && currentPage && <section className="review-page" aria-labelledby="review-title">
        <div className="review-header"><div><div className="eyebrow"><CircleCheck size={16} /> {t.reviewEyebrow}</div><h1 id="review-title">{t.reviewTitle}</h1>
          <div className="review-meta"><strong><FileText size={16} /> {session.fileName}</strong><span>{session.pageCount} {t.pages}</span><span>{flaggedCount} {t.flagged}</span><span>{editedCount} {t.edited}</span>{session.preservedBlockCount > 0 && <span>{session.preservedBlockCount} {t.autoPreserved}</span>}{keptOriginalCount > 0 && <span>{keptOriginalCount} {t.keptOriginalCount}</span>}</div></div>
          <button type="button" className="secondary-button" onClick={reset}><X size={17} /> {t.newDocument}</button></div>
        <div className="review-toolbar"><div className="page-controls"><button type="button" className="icon-button" disabled={pageNumber === 1} onClick={() => setPageNumber((p) => p - 1)} aria-label={t.previousPage}><ChevronLeft size={20} /></button>
          <strong>{t.page} {pageNumber} / {session.pageCount}</strong><button type="button" className="icon-button" disabled={pageNumber === session.pageCount} onClick={() => setPageNumber((p) => p + 1)} aria-label={t.nextPage}><ChevronRight size={20} /></button></div>
          <div className="view-toggle" role="group" aria-label="Comparison view"><button type="button" className={viewMode === "split" ? "is-active" : ""} onClick={() => setViewMode("split")}><Columns2 size={16} /> {t.splitView}</button><button type="button" className={viewMode === "reveal" ? "is-active" : ""} onClick={() => setViewMode("reveal")}><Eye size={16} /> {t.revealView}</button></div>
          <span className={`extraction-badge ${currentPage.extraction}`}>{currentPage.extraction === "document-ai" ? <ScanText size={15} /> : <FileText size={15} />}{currentPage.extraction === "document-ai" ? t.documentAi : t.embedded}</span>
        </div>
        <nav className="page-strip" aria-label="Document pages">{session.pages.map((page) => <button type="button" key={page.page} className={page.page === pageNumber ? "is-active" : ""} onClick={() => setPageNumber(page.page)} aria-current={page.page === pageNumber ? "page" : undefined}><span>{page.page}</span>{page.blocks.some((block) => reviewStatuses[block.id]?.warning && !excludedBlocks[block.id]) && <i aria-label={t.flagged} />}</button>)}</nav>
        <div className="review-workspace"><div className="comparison-column">
          {pdf.error && <div className="preview-warning"><AlertTriangle size={17} /> {t.previewUnavailable}</div>}
          {viewMode === "split" ? <div className="split-comparison">
            <div className="preview-panel"><div className="preview-label"><span>{t.original}</span><small>{t.localPreview}</small></div><PagePreview document={pdf.document} pageNumber={pageNumber} blocks={currentPage.blocks} corrections={corrections} adjustments={boxAdjustments} fontSizes={fontSizeAdjustments} excludedBlocks={excludedBlocks} reviewStatuses={reviewStatuses} activeId={activeBlockId} onSelect={setActiveBlockId} onResize={updateBoxSize} label={`${t.original} ${pageNumber}`} /></div>
            <div className="preview-panel"><div className="preview-label"><span>{t.translated}</span><small>{languageLabel(session.targetLanguage)}</small></div><PagePreview translated document={pdf.document} pageNumber={pageNumber} blocks={currentPage.blocks} corrections={corrections} adjustments={boxAdjustments} fontSizes={fontSizeAdjustments} excludedBlocks={excludedBlocks} reviewStatuses={reviewStatuses} activeId={activeBlockId} onSelect={setActiveBlockId} onResize={updateBoxSize} label={`${t.translated} ${pageNumber}`} /></div>
          </div> : <div className="reveal-comparison"><div className="preview-label"><span>{t.original} ↔ {t.translated}</span><small>{reveal}%</small></div>
            <div className="reveal-stage"><PagePreview document={pdf.document} pageNumber={pageNumber} blocks={currentPage.blocks} corrections={corrections} adjustments={boxAdjustments} fontSizes={fontSizeAdjustments} excludedBlocks={excludedBlocks} reviewStatuses={reviewStatuses} activeId={activeBlockId} onSelect={setActiveBlockId} onResize={updateBoxSize} label={`${t.original} ${pageNumber}`} />
              <div className="reveal-layer" style={{ clipPath: `inset(0 ${100 - reveal}% 0 0)` }}><PagePreview translated document={pdf.document} pageNumber={pageNumber} blocks={currentPage.blocks} corrections={corrections} adjustments={boxAdjustments} fontSizes={fontSizeAdjustments} excludedBlocks={excludedBlocks} reviewStatuses={reviewStatuses} activeId={activeBlockId} onSelect={setActiveBlockId} onResize={updateBoxSize} label={`${t.translated} ${pageNumber}`} /></div>
              <div className="reveal-divider" style={{ left: `${reveal}%` }}><span><ChevronLeft size={14} /><ChevronRight size={14} /></span></div></div>
            <label className="reveal-range"><span>{t.reveal}</span><input type="range" min="0" max="100" value={reveal} onChange={(e) => setReveal(Number(e.target.value))} /></label>
          </div>}
        </div>
        <aside className="block-editor" aria-labelledby="review-panel-title"><div className="editor-heading"><div><span><Pencil size={17} /></span><div><h2 id="review-panel-title">{t.reviewPanel}</h2><p>{t.reviewPanelBody}</p></div></div>
          {pageBlocks.every((block) => !reviewStatuses[block.id]?.warning || excludedBlocks[block.id]) && <span className="all-clear"><Check size={14} /> {t.noReview}</span>}</div>
          <div className="block-list">{pageBlocks.length === 0 && <div className="empty-blocks"><ScanText size={25} /><p>{t.noBlocks}</p></div>}
            {pageBlocks.map((block, index) => { const isExcluded = Boolean(excludedBlocks[block.id]); const review = reviewStatuses[block.id]; return <article key={block.id} className={`block-card${review?.warning && !isExcluded ? " needs-review" : ""}${activeBlockId === block.id ? " is-active" : ""}${isExcluded ? " is-excluded" : ""}`} onClick={() => { if (!isExcluded) setActiveBlockId(block.id); }}>
              <div className="block-card-top"><span>#{String(index + 1).padStart(2, "0")}</span>{isExcluded ? <b className="confidence"><EyeOff size={14} /> {t.originalKept}</b> : review?.warning ? <b><AlertTriangle size={14} /> {review.reason || t.layoutWarning}</b> : <b className="confidence"><Check size={14} /> {Math.round(block.confidence * 100)}% {t.confidence}</b>}</div>
              <label><span>{t.originalText}</span><div className="original-text" lang="auto">{block.originalText}</div></label>
              <button type="button" className={`keep-original-button${isExcluded ? " is-active" : ""}`} onClick={(event) => { event.stopPropagation(); keepOriginal(block); }}>
                {isExcluded ? <Undo2 size={14} /> : <EyeOff size={14} />} {isExcluded ? t.restoreTranslationBlock : t.keepOriginal}
              </button>
              {isExcluded ? <div className="kept-original-note"><EyeOff size={16} /><span><strong>{t.originalKept}</strong>{t.originalKeptHint}</span></div> : <>
              <label><span>{t.translationText}</span><textarea value={blockText(block, corrections)} onChange={(e) => updateCorrection(block, e.target.value)} onFocus={() => setActiveBlockId(block.id)} rows={Math.min(7, Math.max(2, Math.ceil(blockText(block, corrections).length / 54)))} /></label>
              <div className="box-size-controls" onClick={(event) => event.stopPropagation()}>
                <div className="box-size-heading"><div><span>{t.textBoxSize}</span><small>{t.textBoxHint}</small></div>
                  {boxAdjustments[block.id] && <button type="button" onClick={() => restoreBoxSize(block)}><RefreshCw size={12} /> {t.restoreBox}</button>}</div>
                <label className="box-size-range"><span>{t.boxWidth}<b>{Math.round(blockSize(block, boxAdjustments).width * 100)}%</b></span>
                  <input type="range" min={Math.min(0.02, 1 - block.box.x)} max={1 - block.box.x} step="0.005" value={blockSize(block, boxAdjustments).width}
                    onFocus={() => setActiveBlockId(block.id)} onChange={(event) => updateBoxSize(block, { ...blockSize(block, boxAdjustments), width: Number(event.target.value) })} /></label>
                <label className="box-size-range"><span>{t.boxHeight}<b>{Math.round(blockSize(block, boxAdjustments).height * 100)}%</b></span>
                  <input type="range" min={Math.min(0.02, 1 - block.box.y)} max={1 - block.box.y} step="0.005" value={blockSize(block, boxAdjustments).height}
                    onFocus={() => setActiveBlockId(block.id)} onChange={(event) => updateBoxSize(block, { ...blockSize(block, boxAdjustments), height: Number(event.target.value) })} /></label>
                <label className="box-size-range font-size-range"><span><i><Type size={12} /> {t.fontSize}</i><b>{blockFontSize(block, fontSizeAdjustments).toFixed(1)} pt</b></span>
                  <input type="range" min="3.5" max={Math.min(200, Math.max(36, Math.ceil(block.style.fontSize * 1.5)))} step="0.5" value={blockFontSize(block, fontSizeAdjustments)}
                    onFocus={() => setActiveBlockId(block.id)} onChange={(event) => updateFontSize(block, Number(event.target.value))} /></label>
                {fontSizeAdjustments[block.id] !== undefined && <button type="button" className="reset-font-button" onClick={() => updateFontSize(block, block.style.fontSize)}><RefreshCw size={12} /> {t.resetFontSize}</button>}
              </div>
              {corrections[block.id] !== undefined && <button type="button" className="restore-button" onClick={(e) => { e.stopPropagation(); updateCorrection(block, block.translatedText); }}><RefreshCw size={13} /> {t.restore}</button>}
              </>}</article>; })}
          </div>
          <div className="export-panel">{exportNotice && <div className={`export-notice ${exportNotice.kind}`} role="status">{exportNotice.kind === "success" ? <CircleCheck size={17} /> : <AlertCircle size={17} />}{exportNotice.text}</div>}
            <button type="button" className="primary-button download-button" onClick={() => void download()} disabled={exporting}>{exporting ? <LoaderCircle className="spin" size={19} /> : <Download size={19} />}{exporting ? t.exporting : t.download}</button>
            <small>{t.outputNote}</small><span>{t.expires} {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(session.expiresAt))}</span>
          </div>
        </aside></div>
      </section>}
    </main>
    <footer className="site-footer"><span><ShieldCheck size={15} /> {t.footerPrivacy}</span><span className="footer-links"><span>{t.footerTech}</span><a href="#/admin"><LockKeyhole size={13} /> Admin</a></span></footer>
    <div className="sr-live" aria-live="polite" aria-atomic="true">{phase === "processing" ? `${t[progress.stage]} ${Math.round(progress.value)}%` : exportNotice?.text}</div>
  </div>;
}

export function App() {
  const [adminRoute, setAdminRoute] = useState(() => window.location.hash === "#/admin");
  const [ownerAccessKey, setOwnerAccessKey] = useState("");
  useEffect(() => {
    const onHashChange = () => setAdminRoute(window.location.hash === "#/admin");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  if (adminRoute) {
    return <AdminDashboard onBack={() => { window.location.hash = ""; }} onEnableOwnerMode={(accessKey) => {
      setOwnerAccessKey(accessKey);
      window.location.hash = "";
    }} />;
  }
  return <TranslatorApp ownerAccessKey={ownerAccessKey} onDisableOwnerMode={() => setOwnerAccessKey("")} />;
}
