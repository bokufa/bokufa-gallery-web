import type { MutableRefObject, RefObject } from "react";
import type { CanvasView } from "../utils/filmCanvas";

import { useEffect, useRef, useState } from "react";

import { useHdr } from "../contexts/HdrContext";
import { FILM_EDGE_HDR_LABELS } from "../utils/filmGlyphs";

interface FilmEdgeHdrOverlayProps {
  viewportRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
  viewRef: MutableRefObject<CanvasView>;
  sceneChangedRef: MutableRefObject<() => void>;
}

interface ManagedLabel {
  source: HTMLElement;
  overlay: HTMLSpanElement;
  image: HTMLImageElement;
  imageSrc: string;
  worldLeft: number;
  worldTop: number;
  worldWidth: number;
  worldHeight: number;
}

export default function FilmEdgeHdrOverlay({
  viewportRef,
  contentRef,
  viewRef,
  sceneChangedRef,
}: FilmEdgeHdrOverlayProps) {
  const { enabled } = useHdr();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [retained, setRetained] = useState(enabled);

  useEffect(() => {
    if (enabled) {
      setRetained(true);

      return;
    }
    const timer = setTimeout(() => setRetained(false), 650);

    return () => clearTimeout(timer);
  }, [enabled]);

  useEffect(() => {
    const viewport = viewportRef.current!;
    const content = contentRef.current!;
    const overlay = overlayRef.current!;
    let labels: ManagedLabel[] = [];
    let rebuildFrame = 0;

    const update = () => {
      const view = viewRef.current;
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      const wantsHdr =
        overlay.dataset.active === "true" ||
        overlay.dataset.retained === "true";

      for (const label of labels) {
        const left = view.x + label.worldLeft * view.scale;
        const top = view.y + label.worldTop * view.scale;
        const itemWidth = label.worldWidth * view.scale;
        const itemHeight = label.worldHeight * view.scale;

        label.overlay.style.left = `${left}px`;
        label.overlay.style.top = `${top}px`;
        label.overlay.style.width = `${itemWidth}px`;
        label.overlay.style.height = `${itemHeight}px`;
        label.overlay.style.setProperty(
          "--edge-screen-width",
          `${itemWidth}px`,
        );
        label.overlay.style.setProperty(
          "--edge-screen-height",
          `${itemHeight}px`,
        );
        const hidden =
          left + itemWidth <= 0 ||
          top + itemHeight <= 0 ||
          left >= width ||
          top >= height;

        label.overlay.hidden = hidden;
        if (
          !hidden &&
          wantsHdr &&
          label.image.dataset.loading !== "true" &&
          !label.image.getAttribute("src")
        ) {
          label.image.dataset.loading = "true";
          label.image.src = label.imageSrc;
          void label.image
            .decode()
            .then(() => {
              if (label.overlay.isConnected)
                label.overlay.dataset.decoded = "true";
            })
            .catch(() => label.image.removeAttribute("src"))
            .finally(() => delete label.image.dataset.loading);
        }
      }
    };
    const clear = () => {
      for (const label of labels) delete label.source.dataset.edgeScreenManaged;
      labels = [];
      overlay.replaceChildren();
    };
    const rebuild = () => {
      rebuildFrame = 0;
      clear();
      const view = viewRef.current;
      const viewportRect = viewport.getBoundingClientRect();

      labels = [
        ...content.querySelectorAll<HTMLElement>(".film-edge-label"),
      ].flatMap((source) => {
        const text = source.dataset.edgeText?.toUpperCase();
        const src = text ? FILM_EDGE_HDR_LABELS[text] : undefined;
        const vector = source.querySelector<SVGSVGElement>(".film-edge-dots");
        const enteringFrame = source.closest<HTMLElement>(".film-frame-enter");

        if (
          !src ||
          !vector ||
          (enteringFrame &&
            getComputedStyle(enteringFrame).animationName !== "none")
        )
          return [];
        const rect = source.getBoundingClientRect();
        const vertical = rect.height > rect.width;
        const item = document.createElement("span");
        const ink = document.createElement("span");
        const image = document.createElement("img");
        const vectorCopy = vector.cloneNode(true) as SVGSVGElement;

        item.className = `film-edge-screen-label${vertical ? " is-vertical" : ""}`;
        item.dataset.edgeText = text;
        ink.className = "film-edge-screen-ink";
        image.className = "film-edge-screen-hdr";
        image.alt = "";
        image.decoding = "async";
        image.draggable = false;
        image.dataset.hdrActive = "true";
        vectorCopy.className.baseVal = "film-edge-screen-vector";
        ink.append(image, vectorCopy);
        item.append(ink);
        overlay.append(item);
        source.dataset.edgeScreenManaged = "true";

        return [
          {
            source,
            overlay: item,
            image,
            imageSrc: src,
            worldLeft: (rect.left - viewportRect.left - view.x) / view.scale,
            worldTop: (rect.top - viewportRect.top - view.y) / view.scale,
            worldWidth: rect.width / view.scale,
            worldHeight: rect.height / view.scale,
          },
        ];
      });
      update();
    };
    const queueRebuild = () => {
      cancelAnimationFrame(rebuildFrame);
      rebuildFrame = requestAnimationFrame(rebuild);
    };
    const observer = new MutationObserver(queueRebuild);
    const resize = new ResizeObserver(queueRebuild);

    observer.observe(content, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    resize.observe(viewport);
    sceneChangedRef.current = update;
    queueRebuild();

    return () => {
      cancelAnimationFrame(rebuildFrame);
      observer.disconnect();
      resize.disconnect();
      sceneChangedRef.current = () => undefined;
      clear();
    };
  }, [contentRef, sceneChangedRef, viewRef, viewportRef]);

  useEffect(
    () => sceneChangedRef.current(),
    [enabled, retained, sceneChangedRef],
  );

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="film-edge-screen-overlay"
      data-active={enabled}
      data-retained={retained}
    />
  );
}
