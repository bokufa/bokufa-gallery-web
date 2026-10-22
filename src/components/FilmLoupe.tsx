import type { MutableRefObject, RefObject } from "react";
import type { CanvasView } from "../utils/filmCanvas";

import { useEffect, useRef, useState } from "react";
import { TbMinus, TbPlus, TbX } from "react-icons/tb";

import { fetchPhoto } from "../services/photos";
import { preloadPhotoSource } from "../utils/photoSources";
import { mountFilmLoupe } from "../utils/filmLoupeController";
import { useLanguage } from "../contexts/LanguageContext";

const detailImages = new Map<string, Promise<string | undefined>>();

function loadDetailImage(image: HTMLImageElement) {
  const id = image.dataset.filmPhotoId;
  const hdrEnabled = image.dataset.filmHdrEnabled === "true";
  const suppliedUrl =
    (hdrEnabled && image.dataset.filmHdrSrc) || image.dataset.filmLargeSrc;
  const key = `${hdrEnabled ? "hdr" : "sdr"}:${suppliedUrl || `photo:${id}`}`;
  const existing = detailImages.get(key);

  if (existing) return existing;
  const request = (async () => {
    const photo = !suppliedUrl && id ? await fetchPhoto(Number(id)) : undefined;
    const url =
      suppliedUrl ||
      (hdrEnabled && photo?.hdr_file?.url) ||
      photo?.large_file?.url ||
      photo?.medium_file?.url ||
      image.currentSrc ||
      image.src;

    await preloadPhotoSource(url, 1);

    return url;
  })().catch(() => {
    detailImages.delete(key);

    return undefined;
  });

  detailImages.set(key, request);

  return request;
}

interface FilmLoupeProps {
  viewportRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
  viewRef: MutableRefObject<CanvasView>;
  sceneChangedRef: MutableRefObject<() => void>;
  onClose: () => void;
}

export default function FilmLoupe({
  viewportRef,
  contentRef,
  viewRef,
  sceneChangedRef,
  onClose,
}: FilmLoupeProps) {
  const { t } = useLanguage();
  const frameRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  const zoomRef = useRef<(direction: number) => void>(() => undefined);
  const [magnification, setMagnification] = useState(3);

  closeRef.current = onClose;

  useEffect(() => {
    const controller = mountFilmLoupe({
      viewport: viewportRef.current!,
      source: contentRef.current!,
      frame: frameRef.current!,
      glass: glassRef.current!,
      getView: () => viewRef.current,
      loadDetail: loadDetailImage,
      onClose: () => closeRef.current(),
      onMagnification: setMagnification,
    });

    sceneChangedRef.current = controller.sceneChanged;
    zoomRef.current = controller.adjustZoom;

    return () => {
      sceneChangedRef.current = () => undefined;
      zoomRef.current = () => undefined;
      controller.destroy();
    };
  }, [contentRef, sceneChangedRef, viewRef, viewportRef]);

  return (
    <div
      ref={frameRef}
      aria-label={t("loupe")}
      className="film-loupe"
      role="group"
    >
      <button
        ref={glassRef}
        aria-label={t("loupe.glass")}
        className="film-loupe-glass"
        type="button"
      />
      <button
        aria-label={t("loupe.close")}
        className="film-loupe-close"
        title={t("loupe.close")}
        type="button"
        onClick={onClose}
      >
        <TbX size={16} />
      </button>
      <div
        aria-label={t("loupe.zoom")}
        className="film-loupe-controls"
        role="group"
      >
        <button
          aria-label={t("loupe.less")}
          disabled={magnification <= 1.5}
          type="button"
          onClick={() => zoomRef.current(-1)}
        >
          <TbMinus size={15} />
        </button>
        <span aria-live="polite">×{magnification}</span>
        <button
          aria-label={t("loupe.more")}
          disabled={magnification >= 6}
          type="button"
          onClick={() => zoomRef.current(1)}
        >
          <TbPlus size={15} />
        </button>
      </div>
    </div>
  );
}
