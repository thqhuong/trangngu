import { useEffect, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export type PdfState = {
  document: PDFDocumentProxy | null;
  loading: boolean;
  error: string | null;
};

export function usePdf(file: File | null): PdfState {
  const [state, setState] = useState<PdfState>({ document: null, loading: false, error: null });

  useEffect(() => {
    let active = true;
    let task: PDFDocumentLoadingTask | undefined;
    let loadedDocument: PDFDocumentProxy | undefined;

    if (!file) {
      setState({ document: null, loading: false, error: null });
      return;
    }

    setState({ document: null, loading: true, error: null });
    void Promise.all([file.arrayBuffer(), import("pdfjs-dist")])
      .then(([buffer, pdfjs]) => {
        if (!active) return undefined;
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        return task.promise;
      })
      .then((document) => {
        if (!document) return;
        loadedDocument = document;
        if (active) setState({ document, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          document: null,
          loading: false,
          error: error instanceof Error ? error.message : "This PDF could not be opened.",
        });
      });

    return () => {
      active = false;
      void task?.destroy();
      void loadedDocument?.cleanup();
    };
  }, [file]);

  return state;
}
