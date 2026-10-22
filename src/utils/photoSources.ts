import type { Photo } from "../models/gallery";

export function sdrPhotoFile(photo: Photo) {
  return [photo.large_file, photo.medium_file, photo.thumb_file].find((file) =>
    file?.url?.trim(),
  )!;
}

export function preferredPhotoFile(photo: Photo, hdrEnabled: boolean) {
  return hdrEnabled && photo.hdr_file?.url?.trim()
    ? photo.hdr_file
    : sdrPhotoFile(photo);
}

const loads = new Map<string, Promise<void>>();
const pending: Array<{ url: string; priority: number; start: () => void }> = [];
let active: (typeof pending)[number] | undefined;
export const PHOTO_DECODE_TIMEOUT_MS = 12_000;
export const PHOTO_LOAD_TIMEOUT_MS = 30_000;

function pump() {
  if (active || !pending.length) return;
  pending.sort((a, b) => b.priority - a.priority);
  active = pending.shift()!;
  active.start();
}

function queueDecode(
  factory: () => HTMLImageElement,
  priority: number,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  url = "",
) {
  const aborted = () =>
    new DOMException("Image no longer visible", "AbortError");

  if (signal?.aborted) return Promise.reject(aborted());
  const request = new Promise<void>((resolve, reject) => {
    let finished = false;
    let image: HTMLImageElement | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => signal?.removeEventListener("abort", cancel);
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const index = pending.indexOf(task);

      if (index >= 0) pending.splice(index, 1);
      // Only detached preloads own their src; never blank a visible DOM fallback.
      if (error && url && image) image.src = "";
      cleanup();
      if (error) reject(error);
      else resolve();
      if (active === task) active = undefined;
      pump();
    };
    const cancel = () => finish(aborted());
    const task = {
      url,
      priority,
      start: () => {
        timer = setTimeout(
          () =>
            finish(new DOMException("Image decode timed out", "TimeoutError")),
          timeoutMs,
        );
        try {
          if (signal?.aborted) throw aborted();
          image = factory();
          void image.decode().then(() => finish(), finish);
        } catch (error) {
          finish(error);
        }
      },
    };

    signal?.addEventListener("abort", cancel, { once: true });
    pending.push(task);
  });

  pump();

  return request;
}

// A hung/aborted native promise must not hold the shared queue forever. Late
// completion belongs to its old job and cannot unlock a newer active decode.
export function decodePhotoElement(
  image: HTMLImageElement,
  priority = 2,
  signal?: AbortSignal,
  timeoutMs = PHOTO_DECODE_TIMEOUT_MS,
) {
  return queueDecode(() => image, priority, signal, timeoutMs);
}

// Decode original image bytes natively; canvas/re-encoding would discard gain maps.
export function preloadPhotoSource(url: string, priority = 2) {
  const existing = loads.get(url);

  if (existing) {
    const task = pending.find((task) => task.url === url);

    if (task) task.priority = Math.max(task.priority, priority);

    return existing;
  }
  const request = queueDecode(
    () => {
      const image = new Image();

      image.decoding = "async";
      image.src = url;

      return image;
    },
    priority,
    undefined,
    PHOTO_LOAD_TIMEOUT_MS,
    url,
  ).catch((error) => {
    if (loads.get(url) === request) loads.delete(url);
    throw error;
  });

  loads.set(url, request);
  return request;
}
