import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { HiArrowLongLeft } from "react-icons/hi2";
import { useNavigate, useParams } from "react-router-dom";

import PhotoDateInfo from "../components/PhotoDateInfo";
import PhotoImageCard from "../components/PhotoImageCard";
import PhotoLocationInfo from "../components/PhotoLocationInfo";
import PhotoMapCard from "../components/PhotoMapCard";
import PhotoMetaCard from "../components/PhotoMetaCard";
import PhotoTitle from "../components/PhotoTitle";
import useMediaQuery from "../hooks/useMediaQuery";
import type { Photo } from "../models/gallery";
import { fetchPhoto, isCanceledPhotoRequest } from "../services/photos";

type LoadState = "loading" | "ready" | "error" | "not-found";

export default function PhotoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 960px)");
  const photoId = Number(id);
  const [photo, setPhoto] = useState<Photo>();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    if (!Number.isSafeInteger(photoId) || photoId < 0) {
      setLoadState("not-found");
      return;
    }

    const controller = new AbortController();
    setLoadState("loading");

    fetchPhoto(photoId, controller.signal)
      .then((result) => {
        setPhoto(result);
        setLoadState("ready");
      })
      .catch((error) => {
        if (isCanceledPhotoRequest(error)) return;
        setLoadState("error");
      });

    return () => controller.abort();
  }, [photoId, requestVersion]);

  const cityText = useMemo(() => {
    const city = photo?.metadata.city;
    if (!city) return null;
    return (
      <div className="flex gap-1 font-bold text-foreground">
        {city.prefecture.country.name} {city.prefecture.name} {city.name}
      </div>
    );
  }, [photo]);

  if (loadState === "loading") {
    return <div className="flex min-h-[55vh] items-center justify-center"><Spinner label="正在加载照片" /></div>;
  }

  if (!photo || loadState !== "ready") {
    return (
      <div className="flex min-h-[55vh] items-center justify-center px-6">
        <div className="text-center">
          <p className="mb-4 text-sm text-default-500">
            {loadState === "not-found" ? "没有找到这张照片。" : "照片暂时无法加载。"}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="light" onPress={() => navigate(-1)}>返回</Button>
            {loadState === "error" ? (
              <Button variant="flat" onPress={() => setRequestVersion((version) => version + 1)}>重试</Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <article className="scrollbar-hide px-[10px] pb-12 pt-4 md:px-[20px]">
      <div className="mb-6 flex items-center justify-between gap-4 px-2 pt-1 md:mb-9">
        <Button
          size="sm"
          variant="light"
          className="px-0 text-default-500"
          startContent={<HiArrowLongLeft size={20} />}
          onPress={() => navigate(-1)}
        >
          返回
        </Button>
        <span className="text-3xl text-default-400 md:text-4xl">#{photo.id}</span>
      </div>

      <PhotoImageCard photo={photo} isDesktop={isDesktop} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1">
        <PhotoLocationInfo photo={photo} cityLinks={cityText} />
        <PhotoDateInfo photo={photo} />
      </div>
      <div className="px-1 pt-2"><PhotoTitle photo={photo} /></div>

      {photo.description ? (
        <Card className="mt-4">
          <CardBody className="whitespace-pre-wrap text-sm leading-7 text-default-600">
            {photo.description}
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 pb-4 md:grid-cols-2">
        <PhotoMetaCard photo={photo} loading={false} />
        {photo.metadata.location ? (
          <PhotoMapCard photo={photo} className="min-h-[220px] overflow-hidden md:min-h-0" />
        ) : null}
      </div>
    </article>
  );
}
