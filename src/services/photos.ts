import axios from "axios";

import type { Photo, Response } from "../models/gallery";

const photoApi = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? "" : "https://api.bokufa.art"),
  timeout: 20_000,
});

let allPhotosCache: Photo[] | undefined;
let allPhotosRequest: Promise<Photo[]> | undefined;

function loadAllPhotos() {
  if (allPhotosCache) return Promise.resolve(allPhotosCache);
  if (!allPhotosRequest) {
    allPhotosRequest = photoApi
      .get<Response<Photo[]>>("/api/photos/all", { params: { page_size: 2_000 } })
      .then((response) => {
        allPhotosCache = response.data.payload;
        return allPhotosCache;
      })
      .finally(() => {
        allPhotosRequest = undefined;
      });
  }
  return allPhotosRequest;
}

export async function fetchPhoto(id: number, signal?: AbortSignal) {
  const response = await photoApi.get<Response<Photo>>(`/api/photos/${id}`, { signal });
  return response.data.payload;
}

export async function fetchMapPhotos(signal?: AbortSignal) {
  const photos = await fetchPhotos({ page_size: 2_000 }, signal);
  return photos.filter((photo) => photo.metadata.location);
}

export async function fetchPhotos(
  params: {
    page_size: number;
    last_datetime?: string;
    prefecture_id?: string;
    city_id?: string;
  },
  signal?: AbortSignal,
) {
  if (params.prefecture_id || params.city_id) {
    const allPhotos = await loadAllPhotos();
    const filtered = allPhotos.filter((photo) => {
      const city = photo.metadata.city;
      if (params.prefecture_id && city?.prefecture.id.toString() !== params.prefecture_id) return false;
      if (params.city_id && city?.id.toString() !== params.city_id) return false;
      return true;
    });
    let startIndex = 0;
    if (params.last_datetime) {
      const lastIndex = filtered.findIndex(
        (photo) => photo.metadata.datetime === params.last_datetime,
      );
      if (lastIndex < 0) return [];
      startIndex = lastIndex + 1;
    }
    return filtered.slice(startIndex, startIndex + params.page_size);
  }

  const response = await photoApi.get<Response<Photo[]>>("/api/photos/all", {
    params,
    signal,
  });
  if (params.page_size >= 2_000 && !params.last_datetime) {
    allPhotosCache = response.data.payload;
  }
  return response.data.payload;
}

export function isCanceledPhotoRequest(error: unknown) {
  return axios.isCancel(error);
}
