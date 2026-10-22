import type { Photo } from "../models/gallery";
import type { CSSProperties } from "react";

import { Button, Spinner, useDisclosure } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import PhotoModal from "../components/PhotoModal";
import FilmCanvas from "../components/FilmCanvas";
import FilmEdgeMark from "../components/FilmEdgeMark";
import FilmStripBase from "../components/FilmStripBase";
import { fetchPhotos } from "../services/photos";
import { cameraIdentity } from "../utils/cameraIdentity";
import { filmEdgeLabel, filmGeometry } from "../utils/filmGeometry";
import { useHdr } from "../contexts/HdrContext";
import { useLanguage } from "../contexts/LanguageContext";
import BufferedPhotoImage from "../components/BufferedPhotoImage";
import { decodePhotoElement, preloadPhotoSource } from "../utils/photoSources";
import useFilmVisibility from "../hooks/useFilmVisibility";
import {
  filmLoupeDetailFile,
  filmPreviewFile,
  filmSdrPreview,
  filmTableDetailFile,
} from "../utils/filmPhotoSources";
import {
  useFilmCompactMode,
  useFilmDetailQuality,
} from "../contexts/FilmQualityContext";

const loadedFilmImageIds = new Set<number>();
const loadedFilmPreviewUrls = new Set<string>();
const revealedFilmFrameIds = new Set<number>();

function FilmDetailOverlay({
  file,
  hdr,
  photo,
}: {
  file: NonNullable<Photo["medium_file"]>;
  hdr: boolean;
  photo: Photo;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const decodeRef = useRef<AbortController>();
  const [ready, setReady] = useState(false);
  const loupe = filmLoupeDetailFile(photo, hdr);
  const preview = filmPreviewFile(photo, hdr);

  useEffect(() => {
    setReady(false);
    decodeRef.current?.abort();

    return () => decodeRef.current?.abort();
  }, [file.url]);

  return (
    <span
      aria-hidden="true"
      className={`film-table-detail-layer ${ready ? "is-ready" : ""}`}
    >
      <img
        ref={imageRef}
        alt=""
        data-buffer-active={ready}
        data-film-hdr-enabled={hdr}
        data-film-hdr-src={photo.hdr_detail_file?.url || photo.hdr_file?.url}
        data-film-large-src={photo.large_file?.url}
        data-film-loupe-src={loupe?.url}
        data-film-photo-id={photo.id}
        data-film-preview-src={preview.url}
        data-film-table-src={file.url}
        data-film-thumb-src={photo.thumb_file.url}
        data-hdr-active={hdr}
        decoding="async"
        draggable={false}
        fetchPriority="high"
        loading="eager"
        src={file.url}
        onLoad={(event) => {
          const image = event.currentTarget;
          const controller = new AbortController();

          decodeRef.current?.abort();
          decodeRef.current = controller;
          void decodePhotoElement(image, 3, controller.signal)
            .then(() => {
              if (imageRef.current === image) setReady(true);
            })
            .catch(() => undefined)
            .finally(() => {
              if (decodeRef.current === controller)
                decodeRef.current = undefined;
            });
        }}
      />
    </span>
  );
}

function FilmFrame({
  photo,
  index,
  onOpen,
}: {
  photo: Photo;
  index: number;
  onOpen: (photo: Photo) => void;
}) {
  const frameRef = useRef<HTMLButtonElement>(null);
  const { t } = useLanguage();
  const { enabled: hdrEnabled } = useHdr();
  const compact = useFilmCompactMode();
  const detailSelected = useFilmDetailQuality(photo.id);
  const visible = useFilmVisibility(frameRef);
  const [imageLoaded, setImageLoaded] = useState(() =>
    loadedFilmImageIds.has(photo.id),
  );
  const [previewUrl, setPreviewUrl] = useState(() =>
    loadedFilmPreviewUrls.has(filmSdrPreview(photo).url)
      ? filmSdrPreview(photo).url
      : photo.thumb_file.url,
  );
  const [isEntering, setIsEntering] = useState(() => {
    if (revealedFilmFrameIds.has(photo.id)) return false;
    revealedFilmFrameIds.add(photo.id);

    return true;
  });
  const identity = cameraIdentity(photo.metadata);
  const stock = identity.film.stock?.trim() || "FILM";
  const geometry = filmGeometry(photo);
  const { format, portrait } = geometry;
  const edgeLabel = filmEdgeLabel(stock);
  const detailFile = filmTableDetailFile(photo, hdrEnabled);
  const loupeFile = filmLoupeDetailFile(photo, hdrEnabled);

  useEffect(() => {
    if (!visible || compact) {
      setPreviewUrl(photo.thumb_file.url);

      return;
    }
    const preview = filmPreviewFile(photo, hdrEnabled);
    let isActive = true;

    // The base stays small; a separately capped overlay handles high zoom.
    void preloadPhotoSource(preview.url, 0)
      .then(() => {
        if (!isActive) return;
        loadedFilmPreviewUrls.add(preview.url);
        setPreviewUrl(preview.url);
      })
      .catch(() => {
        if (isActive) setPreviewUrl(photo.thumb_file.url);
      });

    return () => {
      isActive = false;
    };
  }, [
    photo.id,
    photo.medium_file,
    photo.hdr_file,
    photo.hdr_preview_file,
    photo.thumb_file.url,
    hdrEnabled,
    compact,
    visible,
  ]);

  return (
    <button
      ref={frameRef}
      aria-label={
        photo.title
          ? t("photo.open", { title: photo.title })
          : t("film.open", { id: photo.id })
      }
      className={`film-frame film-frame-${format} ${portrait ? "film-frame-portrait" : ""} ${isEntering ? "film-frame-enter" : ""}`}
      data-film-format={format}
      data-film-photo-id={photo.id}
      style={
        {
          "--film-frame-width": geometry.frameWidth,
          "--film-frame-height": geometry.frameHeight,
          "--film-image-width": geometry.imageWidth,
          "--film-image-height": geometry.imageHeight,
          animationDelay: `${Math.min(index, 12) * 42}ms`,
        } as CSSProperties
      }
      type="button"
      onAnimationEnd={() => setIsEntering(false)}
      onClick={() => onOpen(photo)}
    >
      {format === "135" ? <FilmStripBase portrait={portrait} /> : null}
      {format === "120" ? (
        <span aria-hidden="true" className="film-fuji-mark">
          <FilmEdgeMark active={visible && !compact} text="FUJI" />
        </span>
      ) : null}
      <span aria-hidden="true" className="film-edge-copy film-edge-copy-start">
        <FilmEdgeMark active={visible && !compact} text={edgeLabel} />
      </span>
      <span
        className={`photo-image-shell film-image-window ${imageLoaded ? "is-loaded" : ""}`}
      >
        <BufferedPhotoImage
          alt={photo.title || ""}
          className={imageLoaded ? "is-loaded" : ""}
          data-film-hdr-enabled={hdrEnabled}
          data-film-hdr-src={photo.hdr_detail_file?.url || photo.hdr_file?.url}
          data-film-large-src={photo.large_file?.url}
          data-film-loupe-src={loupeFile?.url}
          data-film-photo-id={photo.id}
          data-film-preview-src={filmPreviewFile(photo, hdrEnabled).url}
          data-film-table-src={detailFile?.url}
          data-film-thumb-src={photo.thumb_file.url}
          decoding="async"
          draggable={false}
          fetchPriority={index < 4 ? "high" : "auto"}
          hdrSrc={photo.hdr_preview_file?.url}
          loading="eager"
          src={previewUrl}
          suspend={!visible || compact}
          onLoad={() => {
            loadedFilmImageIds.add(photo.id);
            setImageLoaded(true);
          }}
        />
        {/* Detail selection already contains only on-screen frames. Do not
            gate it on IntersectionObserver: transformed elements can report a
            stale off-screen state on mobile Safari after a pinch gesture. */}
        {!compact && detailSelected && detailFile ? (
          <FilmDetailOverlay file={detailFile} hdr={hdrEnabled} photo={photo} />
        ) : null}
      </span>
      <span aria-hidden="true" className="film-edge-copy film-edge-copy-end">
        <FilmEdgeMark active={visible && !compact} text={`▶ ${edgeLabel}`} />
      </span>
    </button>
  );
}

export default function FilmPage() {
  const { t } = useLanguage();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo>();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();

    setIsLoading(true);
    setHasError(false);
    fetchPhotos({ page_size: 2_000, film_only: true }, controller.signal, {
      refresh: true,
    })
      .then(setPhotos)
      .catch((error) => {
        if (error?.name !== "CanceledError") setHasError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [requestVersion]);

  const openPhoto = useCallback(
    (photo: Photo) => {
      window.history.pushState({}, "", `/photo/${photo.id}`);
      setSelectedPhoto(photo);
      onOpen();
    },
    [onOpen],
  );

  const handlePhotoOpenChange = useCallback(
    (nextIsOpen: boolean, path?: string) => {
      if (nextIsOpen) return;
      onClose();
      if (path) navigate(path);
      else window.history.back();
    },
    [navigate, onClose],
  );

  return (
    <section className="film-contact-page">
      {isLoading ? (
        <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center">
          <Spinner
            classNames={{ label: "text-default-500" }}
            color="default"
            label={t("loading")}
          />
        </div>
      ) : null}
      {!isLoading && hasError ? (
        <div
          className="flex min-h-64 flex-col items-center justify-center gap-3 text-default-500"
          role="alert"
        >
          <p>{t("film.error")}</p>
          <Button
            size="sm"
            variant="flat"
            onPress={() => setRequestVersion((version) => version + 1)}
          >
            {t("retry")}
          </Button>
        </div>
      ) : null}
      {!isLoading && !hasError && !photos.length ? (
        <p className="py-16 text-center text-small text-default-400">
          {t("film.empty")}
        </p>
      ) : null}
      {photos.length ? (
        <FilmCanvas>
          <div className="film-contact-grid">
            {photos.map((photo, index) => (
              <FilmFrame
                key={photo.id}
                index={index}
                photo={photo}
                onOpen={openPhoto}
              />
            ))}
          </div>
        </FilmCanvas>
      ) : null}
      {selectedPhoto ? (
        <PhotoModal
          key={selectedPhoto.id}
          isOpen={isOpen}
          photo={selectedPhoto}
          onOpenChange={handlePhotoOpenChange}
        />
      ) : null}
    </section>
  );
}
