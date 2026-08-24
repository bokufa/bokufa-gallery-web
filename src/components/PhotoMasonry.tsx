import { Card, CardBody, CardFooter, Spinner, useDisclosure } from "@heroui/react";
import { useWindowSize } from "@react-hook/window-size";
import {
  useContainerPosition,
  useInfiniteLoader,
  useMasonry,
  usePositioner,
  useResizeObserver,
  useScroller,
} from "masonic";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import useMediaQuery from "../hooks/useMediaQuery";
import type { Photo } from "../models/gallery";
import { fetchPhotos } from "../services/photos";
import PhotoModal from "./PhotoModal";

interface PhotoMasonryProps {
  prefectureId?: string;
  cityId?: string;
}

export default function PhotoMasonry({ prefectureId, cityId }: PhotoMasonryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const loadedIndex = useRef<{ startIndex: number; stopIndex: number }[]>([]);
  const animatedPhotoIds = useRef(new Set<number>());
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();
  const query = useMemo(() => ({
    prefecture_id: prefectureId && prefectureId !== "0" ? prefectureId : undefined,
    city_id: cityId && cityId !== "0" ? cityId : undefined,
  }), [cityId, prefectureId]);

  useEffect(() => {
    let cancelled = false;
    loadedIndex.current = [];
    animatedPhotoIds.current.clear();
    setPhotos([]);
    setIsInitialLoading(true);
    void fetchPhotos({ ...query, page_size: 20 }).then((result) => {
      if (!cancelled) setPhotos(result);
    }).finally(() => {
      if (!cancelled) setIsInitialLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const maybeLoadMore = useInfiniteLoader((startIndex, stopIndex, items) => {
    if (loadedIndex.current.some((entry) => (
      entry.startIndex === startIndex && entry.stopIndex === stopIndex
    ))) return;
    loadedIndex.current.push({ startIndex, stopIndex });

    const lastPhoto = items[items.length - 1] as Photo | undefined;
    if (!lastPhoto) return;
    void fetchPhotos({
      ...query,
      page_size: stopIndex - startIndex + 1,
      last_datetime: lastPhoto.metadata.datetime,
    }).then((result) => {
      if (!result.length) return;
      setPhotos((current) => {
        const currentIds = new Set(current.map((photo) => photo.id));
        const newPhotos = result.filter((photo) => !currentIds.has(photo.id));
        return newPhotos.length ? [...current, ...newPhotos] : current;
      });
    });
  }, {
    isItemLoaded: (index, items) => Boolean(items[index]),
  });

  const openPhotoModal = useCallback((photo: Photo) => {
    window.history.pushState({}, "", `/photo/${photo.id}`);
    setSelectedPhoto(photo);
    onOpen();
  }, [onOpen]);

  const renderMasonryCard = useCallback(({ data, index }: { data: Photo; index: number }) => {
    const shouldAnimate = !animatedPhotoIds.current.has(data.id);
    if (shouldAnimate) animatedPhotoIds.current.add(data.id);
    return (
      <MasonryCard
        data={data}
        index={index}
        shouldAnimate={shouldAnimate}
        onOpenPhoto={openPhotoModal}
      />
    );
  }, [openPhotoModal]);

  const handlePhotoModalOpenChange = useCallback((nextIsOpen: boolean, path?: string) => {
    if (nextIsOpen) return;
    onClose();
    if (path) navigate(path);
    else window.history.back();
  }, [navigate, onClose]);

  return (
    <>
      {isInitialLoading ? (
        <div className="flex min-h-[calc(100dvh-6rem)] items-center justify-center">
          <Spinner
            color="default"
            label="loading"
            classNames={{ label: "text-default-500" }}
          />
        </div>
      ) : null}
      {photos.length ? (
        <MeasuredMasonryGrid
          photos={photos}
          onRender={maybeLoadMore}
          renderCard={renderMasonryCard}
        />
      ) : null}
      {selectedPhoto ? (
        <PhotoModal
          key={selectedPhoto.id}
          photo={selectedPhoto}
          isOpen={isOpen}
          onOpenChange={handlePhotoModalOpenChange}
        />
      ) : null}
    </>
  );
}

interface MasonryGridProps {
  photos: Photo[];
  onRender: (startIndex: number, stopIndex: number, items: Photo[]) => void;
  renderCard: ({ data, index }: { data: Photo; index: number }) => JSX.Element;
}

function MeasuredMasonryGrid(props: MasonryGridProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(host.getBoundingClientRect().width);
      setWidth((current) => current === nextWidth ? current : nextWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="w-full">
      {width > 0 ? <MasonryGrid {...props} width={width} /> : null}
    </div>
  );
}

function MasonryGrid({ photos, onRender, renderCard, width }: MasonryGridProps & { width: number }) {
  const isDesktop = useMediaQuery("(min-width: 960px)");
  const containerRef = useRef<HTMLElement | null>(null);
  const [windowWidth, height] = useWindowSize();
  const { offset } = useContainerPosition(containerRef, [windowWidth, height, width]);
  const positioner = usePositioner({
    width,
    columnGutter: 8,
    columnCount: isDesktop ? 3 : 2,
  });
  const resizeObserver = useResizeObserver(positioner);
  const { scrollTop, isScrolling } = useScroller(offset);

  return useMasonry({
    positioner,
    resizeObserver,
    scrollTop,
    isScrolling,
    height,
    containerRef,
    items: photos,
    overscanBy: 3,
    itemHeightEstimate: 300,
    onRender,
    render: renderCard,
    itemKey: (item: Photo) => item.id,
  });
}

const MasonryCard = memo(function MasonryCard({
  data,
  index,
  shouldAnimate,
  onOpenPhoto,
}: {
  data: Photo;
  index: number;
  shouldAnimate: boolean;
  onOpenPhoto: (photo: Photo) => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 960px)");
  const [imageLoaded, setImageLoaded] = useState(false);
  const openPhotoModal = () => onOpenPhoto(data);

  return (
    <Card
      radius="lg"
      fullWidth
      className={`${shouldAnimate ? "photo-card-enter" : ""} w-full border-none`}
      style={shouldAnimate ? { animationDelay: `${Math.min(index, 12) * 34}ms` } : undefined}
      isPressable={isDesktop}
      onPress={isDesktop ? openPhotoModal : undefined}
    >
      <CardBody
        className="relative overflow-hidden p-0"
        onClick={isDesktop ? undefined : openPhotoModal}
      >
        <div
          className={`photo-image-shell relative w-full overflow-hidden bg-default-100 ${
            imageLoaded ? "is-loaded" : ""
          }`}
          style={{ aspectRatio: `${data.thumb_file.width} / ${data.thumb_file.height}` }}
        >
          <img
            alt={data.title || ""}
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-[opacity,filter,transform] duration-700 ease-out ${
              imageLoaded ? "scale-100 opacity-100 blur-0" : "scale-[1.015] opacity-0 blur-[3px]"
            }`}
            decoding="async"
            draggable={false}
            loading={index < 6 ? "eager" : "lazy"}
            src={data.thumb_file.url}
            onLoad={() => setImageLoaded(true)}
          />
        </div>
      </CardBody>
      {data.metadata.city ? (
        <CardFooter className="flex-wrap justify-between text-small">
          <b>{`${data.metadata.city.prefecture.name} ${data.metadata.city.name}`}</b>
          <p className="text-default-500">{data.metadata.city.prefecture.country.name}</p>
        </CardFooter>
      ) : null}
    </Card>
  );
}, (previous, next) => (
  previous.data === next.data && previous.index === next.index
));
