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
import { preloadPhotoSource } from "../utils/photoSources";

const loadedFilmImageIds = new Set<number>();
const loadedFilmMediumIds = new Set<number>();
const filmMediumLoads = new Map<string, Promise<void>>();
const revealedFilmFrameIds = new Set<number>();

function preloadFilmImage(url: string) {
  const existingLoad = filmMediumLoads.get(url);

  if (existingLoad) return existingLoad;

  const load = new Promise<void>((resolve, reject) => {
    const image = new Image();

    image.decoding = "async";
    image.onload = () => {
      image
        .decode()
        .catch(() => undefined)
        .finally(resolve);
    };
    image.onerror = () => reject(new Error(`Unable to load ${url}`));
    image.src = url;
  }).catch((error) => {
    filmMediumLoads.delete(url);
    throw error;
  });

  filmMediumLoads.set(url, load);

  return load;
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
  const [imageLoaded, setImageLoaded] = useState(() =>
    loadedFilmImageIds.has(photo.id),
  );
  const [previewUrl, setPreviewUrl] = useState(() =>
    photo.medium_file && loadedFilmMediumIds.has(photo.id)
      ? photo.medium_file.url
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

  useEffect(() => {
    const useHdrFile = hdrEnabled && Boolean(photo.hdr_file?.url);
    const mediumFile = useHdrFile ? photo.hdr_file : photo.medium_file;

    // Drop HDR immediately on opt-out, even when the frame is outside the viewport.
    if (!useHdrFile)
      setPreviewUrl(
        photo.medium_file && loadedFilmMediumIds.has(photo.id)
          ? photo.medium_file.url
          : photo.thumb_file.url,
      );

    if (!mediumFile || mediumFile.url === photo.thumb_file.url) return;
    if (!useHdrFile && loadedFilmMediumIds.has(photo.id)) {
      setPreviewUrl(mediumFile.url);

      return;
    }

    let isActive = true;
    let observer: IntersectionObserver | undefined;
    const loadMedium = () => {
      let hdrReady = false;

      // HDR originals can be large. Keep the normal visible-medium upgrade
      // while HDR downloads, but never let a late medium replace decoded HDR.
      if (useHdrFile && photo.medium_file?.url) {
        const fallback = photo.medium_file;

        void preloadFilmImage(fallback.url)
          .then(() => {
            loadedFilmMediumIds.add(photo.id);
            if (isActive && !hdrReady) setPreviewUrl(fallback.url);
          })
          .catch(() => undefined);
      }
      void (
        useHdrFile
          ? preloadPhotoSource(mediumFile.url, 0)
          : preloadFilmImage(mediumFile.url)
      )
        .then(() => {
          if (!isActive) return;
          hdrReady = useHdrFile;
          if (!useHdrFile) loadedFilmMediumIds.add(photo.id);
          setPreviewUrl(mediumFile.url);
        })
        .catch(() => undefined);
    };

    if (frameRef.current && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer?.disconnect();
          loadMedium();
        },
        { rootMargin: "120px 0px" },
      );
      observer.observe(frameRef.current);
    } else {
      loadMedium();
    }

    return () => {
      isActive = false;
      observer?.disconnect();
    };
  }, [
    photo.id,
    photo.medium_file,
    photo.hdr_file,
    photo.thumb_file.url,
    hdrEnabled,
  ]);

  return (
    <button
      ref={frameRef}
      aria-label={
        photo.title ? t("photo.open", { title: photo.title }) : t("film.open", { id: photo.id })
      }
      className={`film-frame film-frame-${format} ${portrait ? "film-frame-portrait" : ""} ${isEntering ? "film-frame-enter" : ""}`}
      data-film-format={format}
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
          <FilmEdgeMark text="FUJI" />
        </span>
      ) : null}
      <span aria-hidden="true" className="film-edge-copy film-edge-copy-start">
        <FilmEdgeMark text={edgeLabel} />
      </span>
      <span
        className={`photo-image-shell film-image-window ${imageLoaded ? "is-loaded" : ""}`}
      >
        <BufferedPhotoImage
          alt={photo.title || ""}
          className={imageLoaded ? "is-loaded" : ""}
          data-film-hdr-enabled={hdrEnabled}
          data-film-hdr-src={photo.hdr_file?.url}
          data-film-large-src={photo.large_file?.url}
          data-film-photo-id={photo.id}
          data-film-thumb-src={photo.thumb_file.url}
          decoding="async"
          draggable={false}
          fetchPriority={index < 4 ? "high" : "auto"}
          hdrSrc={photo.hdr_file?.url}
          loading="eager"
          src={previewUrl}
          onLoad={() => {
            loadedFilmImageIds.add(photo.id);
            setImageLoaded(true);
          }}
        />
      </span>
      <span aria-hidden="true" className="film-edge-copy film-edge-copy-end">
        <FilmEdgeMark text={`▶ ${edgeLabel}`} />
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
    fetchPhotos({ page_size: 2_000, film_only: true }, controller.signal)
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
