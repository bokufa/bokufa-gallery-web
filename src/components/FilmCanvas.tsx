/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The canvas supports keyboard panning and zooming and needs a tab stop. */
import type { CSSProperties, ReactNode } from "react";
import type { CanvasView } from "../utils/filmCanvas";

import { useEffect, useRef, useState } from "react";
import { TbMinus, TbPlus, TbZoomReset, TbZoomScan } from "react-icons/tb";

import { filmSceneWidth, FILM_PIXELS_PER_MM } from "../utils/filmScale";
import {
  boundFilmView,
  defaultFilmView,
  FILM_BOARD_MARGIN,
  FILM_WORLD_HEIGHT,
  MIN_FILM_SCALE,
  minimumFilmScale,
  zoomFilmView,
} from "../utils/filmCanvas";
import { useHdr } from "../contexts/HdrContext";
import { useLanguage } from "../contexts/LanguageContext";
import { FilmQualityProvider } from "../contexts/FilmQualityContext";
import {
  planFilmDetailSelection,
  usesFilmDetail,
} from "../utils/filmDetailSelection";

import FilmLoupe from "./FilmLoupe";
import FilmBoardSurface from "./FilmBoardSurface";
import HdrToggle from "./HdrToggle";
import HdrLightPanel from "./HdrLightPanel";
import FloatingControls, { floatingControlSurface } from "./FloatingControls";

const initialView: CanvasView = { x: 0, y: 0, scale: 1 };

export default function FilmCanvas({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { enabled: hdrEnabled } = useHdr();
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CanvasView>({ ...initialView });
  const controlsRef = useRef<(action: "in" | "out" | "reset") => void>(
    () => undefined,
  );
  const [scale, setScale] = useState(100);
  const [minimumPercent, setMinimumPercent] = useState(MIN_FILM_SCALE * 100);
  const [isLoupeOpen, setIsLoupeOpen] = useState(false);
  const [detailIds, setDetailIds] = useState<ReadonlySet<number>>(new Set());
  const detailIdsRef = useRef<ReadonlySet<number>>(new Set());
  const qualityChangedRef = useRef<() => void>(() => undefined);
  const sceneChangedRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const viewport = viewportRef.current!;
    const content = contentRef.current!;
    const pointers = new Map<number, { x: number; y: number }>();
    let gestureStart: { x: number; y: number } | undefined;
    let suppressClick = false;
    let frame = 0;
    let qualityFrame = 0;
    let releaseFrame = 0;
    let viewportWidth = viewport.clientWidth;

    const commitDetailIds = (ids: ReadonlySet<number>) => {
      if (
        ids.size === detailIdsRef.current.size &&
        [...ids].every((id) => detailIdsRef.current.has(id))
      )
        return false;
      detailIdsRef.current = ids;
      setDetailIds(ids);

      return true;
    };
    const updateDetailQuality = () => {
      qualityFrame = 0;
      const view = viewRef.current;

      // Below the threshold the current cache is deliberately left untouched.
      if (!usesFilmDetail(view.scale)) return;
      const centerX = viewport.clientWidth / 2;
      const centerY = viewport.clientHeight / 2;
      const candidates = [
        ...content.querySelectorAll<HTMLElement>(".film-frame"),
      ].flatMap((element) => {
        const id = Number(element.dataset.filmPhotoId);

        if (!Number.isSafeInteger(id)) return [];
        const left = view.x + element.offsetLeft * view.scale;
        const top = view.y + element.offsetTop * view.scale;
        const width = element.offsetWidth * view.scale;
        const height = element.offsetHeight * view.scale;

        if (
          left + width <= 0 ||
          top + height <= 0 ||
          left >= viewport.clientWidth ||
          top >= viewport.clientHeight
        )
          return [];
        const dx = left + width / 2 - centerX;
        const dy = top + height / 2 - centerY;

        return [{ id, distance: dx * dx + dy * dy }];
      });
      const plan = planFilmDetailSelection(
        detailIdsRef.current,
        candidates,
        view.scale,
      );
      const changed = commitDetailIds(plan.ids);

      cancelAnimationFrame(releaseFrame);
      if (plan.waitForRelease) {
        // One frame removes the old native image; a second frame may allocate
        // its replacement without temporarily exceeding the texture budget.
        releaseFrame = requestAnimationFrame(() => {
          releaseFrame = requestAnimationFrame(() => {
            qualityFrame = requestAnimationFrame(updateDetailQuality);
          });
        });
      } else if (changed)
        qualityFrame = requestAnimationFrame(updateDetailQuality);
    };
    const queueDetailQuality = () => {
      if (!qualityFrame)
        qualityFrame = requestAnimationFrame(updateDetailQuality);
    };

    qualityChangedRef.current = queueDetailQuality;

    const defaultView = () => {
      const frames = [...content.querySelectorAll<HTMLElement>(".film-frame")];
      const rectangles = frames.map((element) => ({
        x: element.offsetLeft,
        y: element.offsetTop,
        width: element.offsetWidth,
        height: element.offsetHeight,
      }));
      const first = rectangles[0];
      const firstRow = rectangles.filter(
        (rect) => Math.abs(rect.y - first.y) <= 1,
      );
      const left = Math.min(...firstRow.map((rect) => rect.x));
      const top = Math.min(...firstRow.map((rect) => rect.y));
      const right = Math.max(...firstRow.map((rect) => rect.x + rect.width));
      const bottom = Math.max(...firstRow.map((rect) => rect.y + rect.height));

      return defaultFilmView(
        viewport.clientWidth,
        viewport.clientHeight,
        content.offsetWidth,
        content.offsetHeight,
        first,
        first
          ? { x: left, y: top, width: right - left, height: bottom - top }
          : undefined,
      );
    };

    const applyView = (view: CanvasView) => {
      viewRef.current = boundFilmView(
        view,
        viewport.clientWidth,
        viewport.clientHeight,
        content.offsetWidth,
        content.offsetHeight,
      );
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const next = viewRef.current;
        const pixelRatio = window.devicePixelRatio || 1;
        const x = Math.round(next.x * pixelRatio) / pixelRatio;
        const y = Math.round(next.y * pixelRatio) / pixelRatio;

        content.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${next.scale})`;
        sceneChangedRef.current();
        queueDetailQuality();
        setScale(Math.round(next.scale * 100));
        setMinimumPercent(
          Math.round(
            minimumFilmScale(
              viewport.clientWidth,
              viewport.clientHeight,
              content.offsetWidth,
              content.offsetHeight,
            ) * 100,
          ),
        );
      });
    };
    const localPoint = (x: number, y: number) => {
      const rect = viewport.getBoundingClientRect();

      return { x: x - rect.left, y: y - rect.top };
    };
    const minimumScale = () =>
      minimumFilmScale(
        viewport.clientWidth,
        viewport.clientHeight,
        content.offsetWidth,
        content.offsetHeight,
      );
    const zoomAt = (factor: number, x: number, y: number) => {
      applyView(
        zoomFilmView(
          viewRef.current,
          viewRef.current.scale * factor,
          x,
          y,
          minimumScale(),
        ),
      );
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointers.set(event.pointerId, localPoint(event.clientX, event.clientY));
      if (pointers.size === 1) {
        gestureStart = { x: event.clientX, y: event.clientY };
        suppressClick = false;
      } else {
        suppressClick = true;
      }
    };
    const pointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);

      if (!previous) return;
      const next = localPoint(event.clientX, event.clientY);

      if (
        !suppressClick &&
        gestureStart &&
        Math.hypot(
          event.clientX - gestureStart.x,
          event.clientY - gestureStart.y,
        ) < 5
      )
        return;
      suppressClick = true;
      viewport.dataset.dragging = "true";
      viewport.setPointerCapture(event.pointerId);
      event.preventDefault();
      const other = [...pointers.entries()].find(
        ([id]) => id !== event.pointerId,
      )?.[1];

      if (other) {
        const oldDistance = Math.hypot(
          previous.x - other.x,
          previous.y - other.y,
        );
        const distance = Math.hypot(next.x - other.x, next.y - other.y);
        const oldCenter = {
          x: (previous.x + other.x) / 2,
          y: (previous.y + other.y) / 2,
        };
        const center = { x: (next.x + other.x) / 2, y: (next.y + other.y) / 2 };
        const zoomed = zoomFilmView(
          viewRef.current,
          (viewRef.current.scale * distance) / Math.max(1, oldDistance),
          oldCenter.x,
          oldCenter.y,
          minimumScale(),
        );

        applyView({
          ...zoomed,
          x: zoomed.x + center.x - oldCenter.x,
          y: zoomed.y + center.y - oldCenter.y,
        });
      } else {
        applyView({
          ...viewRef.current,
          x: viewRef.current.x + next.x - previous.x,
          y: viewRef.current.y + next.y - previous.y,
        });
      }
      pointers.set(event.pointerId, next);
    };
    const pointerEnd = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (viewport.hasPointerCapture(event.pointerId))
        viewport.releasePointerCapture(event.pointerId);
      if (!pointers.size) delete viewport.dataset.dragging;
    };
    const lostCapture = (event: PointerEvent) => {
      if (event.target === viewport) pointerEnd(event);
    };
    const click = (event: MouseEvent) => {
      if (!suppressClick || event.detail === 0) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? viewport.clientHeight
            : 1;

      if (event.ctrlKey || event.metaKey) {
        const point = localPoint(event.clientX, event.clientY);

        zoomAt(
          Math.exp(
            -Math.max(-120, Math.min(120, event.deltaY * unit)) * 0.0025,
          ),
          point.x,
          point.y,
        );
      } else {
        const horizontal = event.shiftKey && !event.deltaX;

        applyView({
          ...viewRef.current,
          x:
            viewRef.current.x -
            (horizontal ? event.deltaY : event.deltaX) * unit,
          y: viewRef.current.y - (horizontal ? 0 : event.deltaY) * unit,
        });
      }
    };
    const control = (action: "in" | "out" | "reset") => {
      if (action === "reset") applyView(defaultView());
      else
        zoomAt(
          action === "in" ? 1.25 : 0.8,
          viewport.clientWidth / 2,
          viewport.clientHeight / 2,
        );
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.target !== viewport) return;
      if (["+", "=", "-", "0"].includes(event.key)) {
        event.preventDefault();
        control(event.key === "0" ? "reset" : event.key === "-" ? "out" : "in");
      } else {
        const movement: Record<string, [number, number]> = {
          ArrowLeft: [60, 0],
          ArrowRight: [-60, 0],
          ArrowUp: [0, 60],
          ArrowDown: [0, -60],
        };
        const delta = movement[event.key];

        if (!delta) return;
        event.preventDefault();
        applyView({
          ...viewRef.current,
          x: viewRef.current.x + delta[0],
          y: viewRef.current.y + delta[1],
        });
      }
    };
    const resize = new ResizeObserver(() => {
      const widthChanged = viewportWidth !== viewport.clientWidth;

      viewportWidth = viewport.clientWidth;
      applyView(widthChanged ? defaultView() : viewRef.current);
    });

    controlsRef.current = control;
    applyView(defaultView());
    resize.observe(viewport);
    resize.observe(content);
    viewport.addEventListener("pointerdown", pointerDown);
    viewport.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerEnd);
    window.addEventListener("pointercancel", pointerEnd);
    viewport.addEventListener("lostpointercapture", lostCapture);
    viewport.addEventListener("click", click, true);
    viewport.addEventListener("wheel", wheel, { passive: false });
    viewport.addEventListener("keydown", keyDown);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(qualityFrame);
      cancelAnimationFrame(releaseFrame);
      resize.disconnect();
      viewport.removeEventListener("pointerdown", pointerDown);
      viewport.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerEnd);
      window.removeEventListener("pointercancel", pointerEnd);
      viewport.removeEventListener("lostpointercapture", lostCapture);
      viewport.removeEventListener("click", click, true);
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("keydown", keyDown);
      qualityChangedRef.current = () => undefined;
    };
  }, []);

  useEffect(() => {
    // Switching SDR/HDR must not retain the previous mode's high-resolution
    // textures. Low previews remain visible while the current center refills.
    detailIdsRef.current = new Set();
    setDetailIds(new Set());
    qualityChangedRef.current();
  }, [hdrEnabled]);

  return (
    <FilmQualityProvider detailIds={detailIds}>
      <div
        className="film-canvas"
        data-hdr-enabled={hdrEnabled}
        style={
          {
            "--film-world-width": `${filmSceneWidth()}px`,
            "--film-world-height": `${FILM_WORLD_HEIGHT}px`,
            "--film-board-margin": `${FILM_BOARD_MARGIN}px`,
            "--film-mm": `${FILM_PIXELS_PER_MM}px`,
          } as CSSProperties
        }
      >
        <HdrLightPanel />
        <div
          ref={viewportRef}
          aria-label={t("film.canvas")}
          className="film-canvas-viewport"
          role="region"
          tabIndex={0}
        >
          <div ref={contentRef} className="film-canvas-content">
            <FilmBoardSurface />
            {children}
          </div>
        </div>
        <FloatingControls>
          <div
            aria-label={t("film.zoom")}
            className={`film-canvas-controls pointer-events-auto ${floatingControlSurface}`}
            role="group"
            title={t("film.gestures")}
          >
            <button
              aria-label={t("zoom.out")}
              disabled={scale <= minimumPercent}
              title={t("zoom.out")}
              type="button"
              onClick={() => controlsRef.current("out")}
            >
              <TbMinus size={18} />
            </button>
            <span aria-label={t("zoom.scale", { scale })}>{scale}%</span>
            <button
              aria-label={t("zoom.in")}
              disabled={scale >= 300}
              title={t("zoom.in")}
              type="button"
              onClick={() => controlsRef.current("in")}
            >
              <TbPlus size={18} />
            </button>
            <button
              aria-label={t("film.reset")}
              title={t("film.reset")}
              type="button"
              onClick={() => controlsRef.current("reset")}
            >
              <TbZoomReset size={18} />
            </button>
            <button
              aria-label={t("loupe")}
              aria-pressed={isLoupeOpen}
              title={t("loupe")}
              type="button"
              onClick={() => setIsLoupeOpen((open) => !open)}
            >
              <TbZoomScan size={18} />
            </button>
            <HdrToggle />
          </div>
        </FloatingControls>
        {isLoupeOpen ? (
          <FilmLoupe
            contentRef={contentRef}
            sceneChangedRef={sceneChangedRef}
            viewRef={viewRef}
            viewportRef={viewportRef}
            onClose={() => setIsLoupeOpen(false)}
          />
        ) : null}
      </div>
    </FilmQualityProvider>
  );
}
