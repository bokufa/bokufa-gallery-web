import type { Photo } from "../models/gallery";

import { useEffect, useState } from "react";

import {
  preferredPhotoFile,
  preloadPhotoSource,
  sdrPhotoFile,
} from "../utils/photoSources";

export default function usePhotoSource(photo: Photo, hdrEnabled: boolean) {
  const sdr = sdrPhotoFile(photo);
  const target = preferredPhotoFile(photo, hdrEnabled);
  const [loaded, setLoaded] = useState({ id: photo.id, file: sdr });
  const [failedUrl, setFailedUrl] = useState("");
  const image = hdrEnabled && loaded.id === photo.id ? loaded.file : sdr;

  useEffect(() => {
    let active = true;

    setFailedUrl("");
    if (!hdrEnabled || target.url === sdr.url) {
      setLoaded({ id: photo.id, file: sdr });

      return;
    }
    void preloadPhotoSource(target.url)
      .then(() => {
        if (active) setLoaded({ id: photo.id, file: target });
      })
      .catch(() => {
        if (!active) return;
        setLoaded({ id: photo.id, file: sdr });
        setFailedUrl(target.url);
      });

    return () => {
      active = false;
    };
  }, [photo.id, hdrEnabled, target.url, sdr.url]);

  return {
    image,
    isHdr: image.url === photo.hdr_file?.url,
    loading: hdrEnabled && target.url !== image.url && failedUrl !== target.url,
    error: hdrEnabled && failedUrl === target.url,
  };
}
