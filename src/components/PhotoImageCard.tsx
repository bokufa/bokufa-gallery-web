import { Card, CardFooter } from "@heroui/react";
import moment from "moment";
import { useState } from "react";

import { Photo } from "../models/gallery";
import { useLanguage } from "../contexts/LanguageContext";
import { sdrPhotoFile } from "../utils/photoSources";
import usePhotoSource from "../hooks/usePhotoSource";

import HdrToggle from "./HdrToggle";
import BufferedPhotoImage from "./BufferedPhotoImage";

export default function PhotoImageCard({
  photo,
  isDesktop,
}: {
  photo: Photo;
  isDesktop: boolean;
}) {
  const { t } = useLanguage();
  // Each newly opened photo starts in SDR, independent of the film table mode.
  const [localHdr, setLocalHdr] = useState({
    id: photo.id,
    enabled: false,
  });
  const enabled = localHdr.id === photo.id && localHdr.enabled;
  const sdr = sdrPhotoFile(photo);
  const { image, loading, error } = usePhotoSource(photo, enabled);

  return (
    <Card
      isFooterBlurred
      className="border-none photo-detail-image-card"
      radius="lg"
    >
      <BufferedPhotoImage
        alt={photo.title || t("photo.fallback")}
        className="object-contain photo-detail-image"
        decoding="async"
        draggable={false}
        hdrSrc={photo.hdr_file?.url}
        height={sdr.height}
        src={image.url}
        style={{
          maxHeight: isDesktop
            ? "calc(100dvh - 20rem)"
            : "calc(100dvh - 18rem)",
          height: "auto",
        }}
        width={sdr.width}
      />
      {photo.hdr_file?.url ? (
        <div className="photo-hdr-control">
          <HdrToggle
            enabled={enabled}
            onToggle={() => setLocalHdr({ id: photo.id, enabled: !enabled })}
          />
          <span className="photo-hdr-status" role="status">
            {loading
              ? t("hdr.loading")
              : error
                ? t("hdr.error")
                : ""}
          </span>
        </div>
      ) : null}
      <CardFooter className="justify-between before:bg-white/10 border-white/20 border-1 overflow-hidden py-1 absolute before:rounded-xl rounded-large bottom-1 shadow-small right-1 z-10 w-auto font-normal">
        <div className="text-tiny md:text-small text-white/80">
          &copy; {moment(photo.metadata.datetime).year()} {photo.author?.name}
        </div>
      </CardFooter>
    </Card>
  );
}
