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
    const labels = new Map<HTMLElement, ManagedLabel>();
    let rebuildFrame = 0;

    const update = () => {
      const view = viewRef.current;
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      const wantsHdr =
        overlay.dataset.active === "true" ||
        overlay.dataset.retained === "true";

      for (const label of labels.values()) {
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
    const remove = (label: ManagedLabel) => {
      delete label.source.dataset.edgeScreenManaged;
      label.overlay.remove();
      labels.delete(label.source);
    };
    const clear = () => {
      for (const label of [...labels.values()]) remove(label);
    };
    const rebuild = () => {
      rebuildFrame = 0;
      const view = viewRef.current;
      const viewportRect = viewport.getBoundingClientRect();
      const retainedSources = new Set<HTMLElement>();

      for (const source of content.querySelectorAll<HTMLElement>(
        ".film-edge-label",
      )) {
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
          continue;
        const rect = source.getBoundingClientRect();
        const vertical = rect.height > rect.width;
        let label = labels.get(source);

        if (label && label.overlay.dataset.edgeText !== text) {
          remove(label);
          label = undefined;
        }
        if (!label) {
          const item = document.createElement("span");
          const ink = document.createElement("span");
          const image = document.createElement("img");
          const vectorCopy = vector.cloneNode(true) as SVGSVGElement;

          item.className = "film-edge-screen-label";
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
          label = {
            source,
            overlay: item,
            image,
            imageSrc: src,
            worldLeft: 0,
            worldTop: 0,
            worldWidth: 0,
            worldHeight: 0,
          };
          labels.set(source, label);
        }
        label.overlay.classList.toggle("is-vertical", vertical);
        label.worldLeft = (rect.left - viewportRect.left - view.x) / view.scale;
        label.worldTop = (rect.top - viewportRect.top - view.y) / view.scale;
        label.worldWidth = rect.width / view.scale;
        label.worldHeight = rect.height / view.scale;
        source.dataset.edgeScreenManaged = "true";
        retainedSources.add(source);
      }
      for (const label of [...labels.values()])
        if (!retainedSources.has(label.source)) remove(label);
      update();
    };
    const queueRebuild = () => {
      cancelAnimationFrame(rebuildFrame);
      rebuildFrame = requestAnimationFrame(rebuild);
    };
    const containsEdgeLabel = (nodes: NodeList) =>
      [...nodes].some(
        (node) =>
          node instanceof Element &&
          (node.matches(".film-edge-label") ||
            Boolean(node.querySelector(".film-edge-label"))),
      );
    const observer = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            containsEdgeLabel(record.addedNodes) ||
            containsEdgeLabel(record.removedNodes),
        )
      )
        queueRebuild();
    });
    const resize = new ResizeObserver(queueRebuild);
    const animationEnd = (event: AnimationEvent) => {
      if ((event.target as Element).matches(".film-frame-enter"))
        queueRebuild();
    };

    observer.observe(content, {
      childList: true,
      subtree: true,
    });
    resize.observe(viewport);
    content.addEventListener("animationend", animationEnd);
    sceneChangedRef.current = update;
    queueRebuild();

    return () => {
      cancelAnimationFrame(rebuildFrame);
      observer.disconnect();
      resize.disconnect();
      content.removeEventListener("animationend", animationEnd);
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
