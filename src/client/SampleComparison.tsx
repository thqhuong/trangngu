import { Check, ChevronLeft, ChevronRight, Columns2, Eye, FileText, ScanText, Sparkles } from "lucide-react";
import { useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Locale } from "./i18n";

const sampleCopy = {
  en: {
    eyebrow: "Try the magic moment", title: "See the layout survive the translation",
    body: "This real one-page sample keeps its columns, callouts, icons, and visual hierarchy while the words change from English to Vietnamese.",
    split: "Side by side", reveal: "Drag to reveal", original: "Original · English", translated: "Translated · Vietnamese",
    drag: "Drag the line across the page",
    note: "Reviewed Gemini output · selectable text · no quota used to explore this preview",
    stepOne: "Read structure", stepTwo: "Translate with Gemini", stepThree: "Rebuild PDF",
  },
  vi: {
    eyebrow: "Thử khoảnh khắc ấn tượng", title: "Xem bố cục được giữ nguyên khi dịch",
    body: "Mẫu một trang thực tế này giữ cột, khung chú thích, biểu tượng và hệ thống thị giác khi nội dung đổi từ tiếng Anh sang tiếng Việt.",
    split: "Hai bên", reveal: "Kéo để so sánh", original: "Bản gốc · Tiếng Anh", translated: "Bản dịch · Tiếng Việt",
    drag: "Kéo đường chia ngang qua trang",
    note: "Kết quả Gemini đã kiểm tra · chọn được chữ · xem mẫu không tốn hạn mức",
    stepOne: "Đọc cấu trúc", stepTwo: "Dịch bằng Gemini", stepThree: "Dựng lại PDF",
  },
} as const;

export function SampleComparison({ locale }: { locale: Locale }) {
  const [mode, setMode] = useState<"split" | "reveal">("reveal");
  const [position, setPosition] = useState(52);
  const t = sampleCopy[locale];
  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition(Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100)));
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const amount = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowLeft") { event.preventDefault(); setPosition((value) => Math.max(0, value - amount)); }
    if (event.key === "ArrowRight") { event.preventDefault(); setPosition((value) => Math.min(100, value + amount)); }
    if (event.key === "Home") { event.preventDefault(); setPosition(0); }
    if (event.key === "End") { event.preventDefault(); setPosition(100); }
  };

  return <section className="sample-comparison" aria-labelledby="sample-comparison-title">
    <div className="sample-heading"><div><div className="eyebrow"><Sparkles size={16} /> {t.eyebrow}</div><h2 id="sample-comparison-title">{t.title}</h2><p>{t.body}</p></div>
      <div className="sample-mode-toggle" role="group" aria-label="Sample comparison view">
        <button type="button" className={mode === "split" ? "is-active" : ""} onClick={() => setMode("split")}><Columns2 size={16} /> {t.split}</button>
        <button type="button" className={mode === "reveal" ? "is-active" : ""} onClick={() => setMode("reveal")}><Eye size={16} /> {t.reveal}</button>
      </div>
    </div>

    <div className="sample-process" aria-label="How TrangNgữ transforms the sample">
      <span><i><ScanText size={17} /></i>{t.stepOne}<Check size={13} /></span>
      <b />
      <span><i><Sparkles size={17} /></i>{t.stepTwo}<Check size={13} /></span>
      <b />
      <span><i><FileText size={17} /></i>{t.stepThree}<Check size={13} /></span>
    </div>

    {mode === "split" ? <div className="sample-split">
      <figure><figcaption>{t.original}</figcaption><img src="/sample/trangngu-sample-original.png" alt="Original English flood readiness sample PDF page" /></figure>
      <figure><figcaption>{t.translated}</figcaption><img src="/sample/trangngu-sample-translated.png" alt="Vietnamese translated sample PDF page with matching layout" /></figure>
    </div> : <div className="sample-reveal-wrap">
      <div className="sample-reveal-stage" role="slider" tabIndex={0} aria-label={t.drag} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position)}
        onPointerDown={onPointerDown} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event); }} onKeyDown={onKeyDown}>
        <img draggable={false} src="/sample/trangngu-sample-original.png" alt="Original English sample PDF page" />
        <div className="sample-reveal-layer" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><img draggable={false} src="/sample/trangngu-sample-translated.png" alt="Vietnamese translated sample PDF page" /></div>
        <span className="sample-corner-label is-original">{t.original}</span><span className="sample-corner-label is-translated">{t.translated}</span>
        <div className="sample-reveal-line" style={{ left: `${position}%` }} aria-hidden="true"><span><ChevronLeft size={15} /><ChevronRight size={15} /></span></div>
      </div>
      <p className="sample-drag-hint"><ChevronLeft size={14} /> {t.drag} <ChevronRight size={14} /></p>
    </div>}

    <div className="sample-actions"><span>{t.note}</span></div>
  </section>;
}
