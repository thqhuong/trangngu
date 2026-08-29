import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

type PdfCanvasProps = {
  document: PDFDocumentProxy | null;
  pageNumber: number;
  label: string;
};

export function PdfCanvas({ document, pageNumber, label }: PdfCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setWidth(Math.floor(host.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let renderTask: RenderTask | undefined;
    const canvas = canvasRef.current;
    if (!document || !canvas || width < 20) return;

    setRendered(false);
    setError(false);
    void document
      .getPage(pageNumber)
      .then((page) => {
        if (!active) return;
        const base = page.getViewport({ scale: 1 });
        const cssScale = width / base.width;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: cssScale * pixelRatio });
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas is unavailable");

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        return renderTask.promise;
      })
      .then(() => {
        if (active) setRendered(true);
      })
      .catch((renderError: unknown) => {
        if (!active || (renderError instanceof Error && renderError.name === "RenderingCancelledException")) return;
        setError(true);
      });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [document, pageNumber, width]);

  return (
    <div ref={hostRef} className="pdf-canvas-shell" aria-label={label}>
      {!rendered && !error && <div className="pdf-loading" aria-hidden="true" />}
      {error && <div className="pdf-render-error">PDF preview unavailable</div>}
      <canvas ref={canvasRef} className={rendered ? "is-rendered" : ""} />
    </div>
  );
}
