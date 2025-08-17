import { useEffect, useMemo, useState, useRef } from "react";
import { usePositioner, useContainerPosition, useMasonry, useScroller, useInfiniteLoader } from "masonic";
import { useWindowSize } from "@react-hook/window-size";
import { Card, Image, CardFooter, CardBody, useDisclosure } from "@heroui/react";
import { Photo, Response } from "../models/gallery.ts";
import axios from "axios";
import PhotoModal from "./photo_modal.tsx";

// 全部照片数据（固定的，不会无限生成）
const allPhotos = [
  { id: 1, url: "/img/DSC01507.JPG", title: "风景1", height: 4672, width: 7008, metadata: {}, thumb_file: {url: '/img/DSC01507_thumbnail_512x341.jpg', height: 341, width: 512} },
  { id: 2, url: "/img/higashifushimi.jpg", title: "风景2", height: 4320, width: 7680, metadata: {}, thumb_file: {url: '/img/higashifushimi_thumbnail_512x288.jpg', height: 288, width: 512} },
  { id: 3, url: "/img/sunset.jpg", title: "风景3", height: 1920, width: 1280, metadata: {}, thumb_file: {url: '/img/sunset_thumbnail_341x512.jpg', height: 512, width: 341} },
  { id: 4, url: "/img/DSC01507.JPG", title: "风景4", height: 4672, width: 7008, metadata: {}, thumb_file: {url: '/img/DSC01507_thumbnail_512x341.jpg', height: 341, width: 512} },
  { id: 5, url: "/img/higashifushimi.jpg", title: "风景5", height: 4320, width: 7680, metadata: {}, thumb_file: {url: '/img/higashifushimi_thumbnail_512x288.jpg', height: 288, width: 512} },
  { id: 6, url: "/img/sunset.jpg", title: "风景6", height: 1920, width: 1280, metadata: {}, thumb_file: {url: '/img/sunset_thumbnail_341x512.jpg', height: 512, width: 341} },
  // { id: 7, url: "/img/DSC01507.JPG", title: "风景7" },
  // { id: 8, url: "/img/higashifushimi.jpg", title: "风景8" },
  // { id: 9, url: "/img/sunset.jpg", title: "风景9" },
  // { id: 10, url: "/img/DSC01507.JPG", title: "风景10" },
];

// 模拟加载（从 allPhotos 中取）
function fetchMorePhotos(currentLength: number, count = 3) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const nextPhotos = allPhotos.slice(currentLength, currentLength + count);
      resolve(nextPhotos);
    }, 500); // 模拟延迟
  });
}

const PhotoCard = ({ data, photo_width }: { data: Photo, photo_width: number}) => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const openPhotoModel = useMemo(() => () => {
    history.pushState({}, '', `/photo/${data.id}`)
    onOpen();
  }, [onOpen, data.id])

  return <Card
    radius="lg"
    className="border-none"
    isPressable={true}
    onPress={openPhotoModel}
  >
    <CardBody className="overflow-visible p-0">
      <Image
        className="object-cover"
        draggable={false}
        classNames={{
          img: 'pointer-events-none',
          blurredImg: 'pointer-events-none'
        }}
        src={data.thumb_file.url}
        width={data.thumb_file.width}
        height={data.thumb_file.height}
        style={{ height: 'auto' }}
      />
    </CardBody>
    {
      data.metadata.city ?
        <CardFooter className="text-small justify-between flex-wrap">
          <b>
            {`${data.metadata.city.prefecture.name} ${data.metadata.city.name}`}
          </b>
          <p className="text-default-500">
            {`${data.metadata.city.prefecture.country.name}`}
          </p>
        </CardFooter>
        :
        null
    }

    <PhotoModal photo={data} isOpen={isOpen} onOpenChange={(isOpen, path) => {
      if (!isOpen && path) {
        navigate(path)
      } else if (!isOpen) {
        history.back()
      }
      onOpenChange()
    }}/>
  </Card>
}

export default function PhotoMasonry(props: { prefectureId?: string, cityId?: string }) {
  // 初始只显示 4 张
  // const [photos, setPhotos] = useState(allPhotos.slice(0, 4));
  const [photos, setPhotos] = useState<Photo[]>([])
  const loadedRanges = useRef<{ startIndex: number; stopIndex: number }[]>([]);
  const loadedIndex = useRef<{ startIndex: number, stopIndex: number }[]>([]);

  const containerRef = useRef(null);
  const [windowWidth, height] = useWindowSize();
  const { offset, width } = useContainerPosition(containerRef, [windowWidth, height]);
  const columnCount = 3
  const columnGutter = 8; 
  const columnWidth = Math.floor((width - columnGutter * (columnCount - 1)) / columnCount);
  const positioner = usePositioner({
    width,
    columnGutter,
    columnCount,
  });

  const { scrollTop, isScrolling } = useScroller(offset);

  // const maybeLoadMore = useInfiniteLoader(
  //   async (startIndex, stopIndex, items) => {
  //     if (loadedRanges.current.find(r => r.startIndex === startIndex && r.stopIndex === stopIndex)) return;
  //     loadedRanges.current.push({ startIndex, stopIndex });

  //     const newPhotos = await fetchMorePhotos(items.length, stopIndex - startIndex);
  //     if ((newPhotos as any[]).length > 0) {
  //       setPhotos(prev => [...prev, ...(newPhotos as any[])]);
  //     }
  //   },
  //   { isItemLoaded: (index, items) => !!items[index] }
  // );
  const query = useMemo(() => ({
    prefecture_id: props.prefectureId && props.prefectureId !== '0' ? props.prefectureId : undefined,
    city_id: props.cityId && props.cityId !== '0' ? props.cityId : undefined,
  }), [props.cityId, props.prefectureId])
  useEffect(() => {
    axios.get<Response<Photo[]>>('http://localhost:3000/photos/all', {
      params: {
        ...query,
        page_size: 20
      }
    }).then(res => {
      setPhotos(res.data.payload)
    })
  }, [query])

  const maybeLoadMore = useInfiniteLoader((startIndex, stopIndex, items) => {
    if (loadedIndex.current.find((e) => e.startIndex === startIndex && e.stopIndex === stopIndex)) {
      return;
    }
    loadedIndex.current.push({ startIndex, stopIndex })

    const lastDate = (items[items.length - 1] as Photo).metadata.datetime
    axios.get<Response<Photo[]>>('http://localhost:3000/photos/all', {
      params: {
        ...query,
        page_size: stopIndex - startIndex,
        last_datetime: lastDate,
      }
    }).then((res) => {
      if (res.data.payload.length > 0) {
        setPhotos((current) => [...current, ...res.data.payload]);
      }
    })
  }, {
    isItemLoaded: (index, items) => !!items[index],
  });

  return useMasonry({
    positioner,
    scrollTop,
    isScrolling,
    height,
    containerRef,
    items: photos,
    overscanBy: 3,
    itemHeightEstimate: 0,
    onRender: maybeLoadMore,
    render: (props) => <PhotoCard {...props} photo_width={ columnWidth } />,
    itemKey: (item) => item.id,
  });
}
