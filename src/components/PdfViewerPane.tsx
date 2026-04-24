import { memo, useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useI18n } from "../i18n/I18nProvider";

GlobalWorkerOptions.workerSrc = workerUrl;

type ZoomMode = "fit-width" | "fit-page" | "manual";

const minimumManualZoom = 10;
const maximumManualZoom = 1000;

interface PdfViewerPaneProps {
  sourceKey: string;
  pdfData: Uint8Array | null;
  currentPageIndex: number;
  pageCount: number;
  onPageIndexChange: (pageIndex: number) => void;
  fallbackText: string | null;
  fallbackLabel: string | null;
}

interface ScrollAnchor {
  contentX: number;
  contentY: number;
  clientX: number;
  clientY: number;
}

function clampZoom(percent: number) {
  return Math.min(Math.max(percent, minimumManualZoom), maximumManualZoom);
}

export const PdfViewerPane = memo(function PdfViewerPane(props: PdfViewerPaneProps) {
  const { t } = useI18n();
  const { sourceKey, pdfData, currentPageIndex, pageCount, onPageIndexChange, fallbackText, fallbackLabel } = props;
  const [documentRef, setDocumentRef] = useState<PDFDocumentProxy | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState("");
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit-width");
  const [manualZoomPercent, setManualZoomPercent] = useState(125);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [pageBaseSize, setPageBaseSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollAnchorRef = useRef<ScrollAnchor | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderSequenceRef = useRef(0);
  const loadedDocumentRef = useRef<PDFDocumentProxy | null>(null);

  useEffect(() => {
    pendingScrollAnchorRef.current = null;
    renderTaskRef.current?.cancel();
    setDocumentRef(null);
    setLoadError("");
    if (!pdfData) {
      setLoadState("idle");
    }
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (context) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 0;
      canvas.height = 0;
    }
  }, [sourceKey, pdfData]);

  useEffect(() => {
    let cancelled = false;

    if (!pdfData) {
      setLoadState("idle");
      return;
    }

    setLoadState("loading");
    const loadingTask = getDocument({ data: pdfData });
    loadingTask.promise
      .then((pdf) => {
        if (!cancelled) {
          void loadedDocumentRef.current?.destroy();
          loadedDocumentRef.current = pdf;
          setDocumentRef(pdf);
          setLoadState("ready");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(String(error));
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [pdfData]);

  useEffect(() => {
    return () => {
      renderTaskRef.current?.cancel();
      void loadedDocumentRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    const element = viewerScrollRef.current;
    if (!element) {
      return;
    }

    function updateSize() {
      const currentElement = viewerScrollRef.current;
      if (!currentElement) {
        return;
      }
      setContainerSize({
        width: currentElement.clientWidth,
        height: currentElement.clientHeight,
      });
    }

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function readPageMetrics() {
      if (!documentRef) {
        setPageBaseSize({ width: 0, height: 0 });
        return;
      }

      const pageNumber = Math.min(Math.max(currentPageIndex + 1, 1), documentRef.numPages);
      const page = await documentRef.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1, rotation: page.rotate });

      if (!cancelled) {
        setPageBaseSize({
          width: viewport.width,
          height: viewport.height,
        });
      }
    }

    void readPageMetrics();

    return () => {
      cancelled = true;
    };
  }, [currentPageIndex, documentRef]);

  const effectiveScale = useMemo(() => {
    if (zoomMode === "manual") {
      return manualZoomPercent / 100;
    }

    if (pageBaseSize.width === 0 || pageBaseSize.height === 0) {
      return 1;
    }

    const availableWidth = Math.max(containerSize.width - 32, 100);
    const availableHeight = Math.max(containerSize.height - 32, 100);

    if (zoomMode === "fit-page") {
      return Math.min(availableWidth / pageBaseSize.width, availableHeight / pageBaseSize.height);
    }

    return availableWidth / pageBaseSize.width;
  }, [
    containerSize.height,
    containerSize.width,
    manualZoomPercent,
    pageBaseSize.height,
    pageBaseSize.width,
    zoomMode,
  ]);

  const loadingMessage = useMemo(() => {
    if (!pdfData && fallbackText?.trim()) {
      return "";
    }
    if (loadState === "idle") {
      return t("viewer.loadPdfPrompt");
    }
    if (loadState === "loading") {
      return t("viewer.loadingPdf");
    }
    if (loadState === "error") {
      return t("viewer.unableToLoadPdf", { error: loadError });
    }
    return "";
  }, [loadError, loadState, t]);

  const hasFallbackText = Boolean(fallbackText?.trim());
  const normalizedFallbackText = fallbackText?.trim() ?? "";

  useEffect(() => {
    let cancelled = false;
    const renderSequence = renderSequenceRef.current + 1;
    renderSequenceRef.current = renderSequence;

    async function renderPage() {
      if (!documentRef || !canvasRef.current) {
        return;
      }

      const pageNumber = Math.min(Math.max(currentPageIndex + 1, 1), documentRef.numPages);
      const page = await documentRef.getPage(pageNumber);
      const viewport = page.getViewport({ scale: effectiveScale, rotation: page.rotate });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.transform = "none";
      canvas.style.transformOrigin = "top left";
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      renderTaskRef.current?.cancel();
      const renderTask = page.render({
        canvasContext: context,
        viewport,
      });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
      } catch (error) {
        if (String(error).includes("RenderingCancelledException")) {
          return;
        }
        throw error;
      }

      if (!cancelled && renderSequenceRef.current === renderSequence) {
        const anchor = pendingScrollAnchorRef.current;
        if (anchor && viewerScrollRef.current) {
          viewerScrollRef.current.scrollLeft = anchor.contentX * effectiveScale - anchor.clientX;
          viewerScrollRef.current.scrollTop = anchor.contentY * effectiveScale - anchor.clientY;
          pendingScrollAnchorRef.current = null;
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [currentPageIndex, documentRef, effectiveScale]);

  function setManualZoom(percent: number, anchor?: ScrollAnchor) {
    if (anchor) {
      pendingScrollAnchorRef.current = anchor;
    }
    setZoomMode("manual");
    setManualZoomPercent(clampZoom(percent));
  }

  function handleViewerWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    const container = viewerScrollRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const currentPercent = Math.round(effectiveScale * 100);
    const step = event.deltaY < 0 ? 10 : -10;
    const nextPercent = clampZoom(currentPercent + step);
    const anchor: ScrollAnchor = {
      contentX: (container.scrollLeft + (event.clientX - rect.left)) / effectiveScale,
      contentY: (container.scrollTop + (event.clientY - rect.top)) / effectiveScale,
      clientX: event.clientX - rect.left,
      clientY: event.clientY - rect.top,
    };

    setManualZoom(nextPercent, anchor);
  }

  return (
    <section className="pane pane-viewer">
      <div className="pane-toolbar viewer-toolbar">
        {documentRef ? (
          <>
            <div className="action-row viewer-toolbar-group">
              <button
                className="secondary-button compact-button"
                onClick={() => onPageIndexChange(Math.max(currentPageIndex - 1, 0))}
                disabled={!documentRef || currentPageIndex <= 0}
              >
                {t("viewer.previous")}
              </button>
              <button
                className="secondary-button compact-button"
                onClick={() => onPageIndexChange(Math.min(currentPageIndex + 1, Math.max(pageCount - 1, 0)))}
                disabled={!documentRef || currentPageIndex >= Math.max(pageCount - 1, 0)}
              >
                {t("viewer.next")}
              </button>
              <label className="inline-control">
                <span>{t("viewer.jump")}</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(pageCount, 1)}
                  value={Math.min(currentPageIndex + 1, Math.max(pageCount, 1))}
                  onChange={(event) =>
                    onPageIndexChange(
                      Math.min(
                        Math.max(Number(event.target.value || "1") - 1, 0),
                        Math.max(pageCount - 1, 0),
                      ),
                    )
                  }
                />
              </label>
            </div>
            <div className="action-row viewer-toolbar-group">
              <button
                className={`secondary-button compact-button ${zoomMode === "fit-width" ? "is-active" : ""}`}
                onClick={() => {
                  pendingScrollAnchorRef.current = null;
                  setZoomMode("fit-width");
                }}
              >
                {t("viewer.fitWidth")}
              </button>
              <button
                className={`secondary-button compact-button ${zoomMode === "fit-page" ? "is-active" : ""}`}
                onClick={() => {
                  pendingScrollAnchorRef.current = null;
                  setZoomMode("fit-page");
                }}
              >
                {t("viewer.fitPage")}
              </button>
              <label className="inline-control">
                <span>{t("viewer.zoomLabel")}</span>
                <input
                  type="number"
                  min={minimumManualZoom}
                  max={maximumManualZoom}
                  value={Math.round(zoomMode === "manual" ? manualZoomPercent : effectiveScale * 100)}
                  onChange={(event) => setManualZoom(Number(event.target.value || "100"))}
                />
              </label>
              <span className="viewer-meta">{t("viewer.pageCounter", { current: currentPageIndex + 1, total: pageCount })}</span>
              <span className="viewer-meta viewer-help">{t("viewer.zoomHelp")}</span>
            </div>
          </>
        ) : (
          <div className="action-row viewer-toolbar-group viewer-text-toolbar">
            <strong>{hasFallbackText ? t("viewer.readingText") : t("viewer.noPreview")}</strong>
            {fallbackLabel ? <span className="viewer-meta">{fallbackLabel}</span> : null}
            {hasFallbackText ? <span className="viewer-meta viewer-help">{t("viewer.readingTextHelp")}</span> : null}
          </div>
        )}
      </div>
      <div ref={viewerScrollRef} className="viewer-surface" onWheel={handleViewerWheel}>
        {documentRef ? (
          <div className="pdf-stage">
            <canvas ref={canvasRef} className="pdf-canvas" />
          </div>
        ) : hasFallbackText ? (
          <article className="text-preview-card">
            <pre className="text-preview-content">{normalizedFallbackText}</pre>
          </article>
        ) : (
          <p>{loadingMessage}</p>
        )}
      </div>
    </section>
  );
});
