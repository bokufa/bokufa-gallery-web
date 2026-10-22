import type { CanvasView } from "./filmCanvas";

import {
  boundLoupePosition,
  circleIntersectsRect,
  loupeSampleCircle,
  loupeSceneView,
} from "./filmLoupe";
import { decodePhotoElement, PHOTO_LOAD_TIMEOUT_MS } from "./photoSources";

export const MAX_LOUPE_DETAIL_IMAGES = 2;

type Rect = { left: number; top: number; right: number; bottom: number };
type Pending = {
  image: HTMLImageElement;
  url: string;
  version: number;
  decoded: boolean;
  started?: boolean;
  cancelFade?: () => void;
  controller: AbortController;
};
type Entry = {
  edgeState?: string;
  source: HTMLElement;
  original: HTMLImageElement;
  frame: HTMLElement;
  image: HTMLImageElement;
  previewImage: HTMLImageElement;
  bounds: Rect;
  imageBounds: Rect;
  preview: string;
  identity: string;
  requested?: string;
  readyUrl?: string;
  pending?: Pending;
  visible: boolean;
  detailSelected: boolean;
  version: number;
};

interface Options {
  viewport: HTMLElement;
  source: HTMLElement;
  frame: HTMLElement;
  glass: HTMLButtonElement;
  getView: () => CanvasView;
  loadDetail: (image: HTMLImageElement) => Promise<string | undefined>;
  onClose: () => void;
  onMagnification: (zoom: number) => void;
}

const activeImage = (frame: HTMLElement) =>
  frame.querySelector<HTMLImageElement>(
    '.film-table-detail-layer.is-ready img[data-buffer-active="true"]',
  ) ||
  frame.querySelector<HTMLImageElement>(
    '.film-image-window .buffered-photo img[data-buffer-active="true"]',
  );
const emptyRect = (): Rect => ({ left: 0, top: 0, right: 0, bottom: 0 });
const identity = (image: HTMLImageElement) =>
  [
    image.dataset.filmPhotoId,
    image.dataset.filmHdrEnabled,
    image.dataset.filmHdrSrc,
    image.dataset.filmLargeSrc,
    image.dataset.filmLoupeSrc,
  ].join(":");

export function mountFilmLoupe({
  viewport,
  source,
  frame,
  glass,
  getView,
  loadDetail,
  onClose,
  onMagnification,
}: Options) {
  let width = viewport.clientWidth;
  let height = viewport.clientHeight;
  let center = { x: width / 2, y: height / 2 };
  let diameter = 0;
  let zoom = 3;
  let animationFrame = 0;
  let qualityTimer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  let entries: Entry[] = [];
  const paints = new Set<number>();
  let drag:
    | { id: number; x: number; y: number; centerX: number; centerY: number }
    | undefined;
  const mirror = source.cloneNode(false) as HTMLElement;

  mirror.classList.add("film-loupe-scene");
  mirror.setAttribute("aria-hidden", "true");
  mirror.setAttribute("inert", "");
  glass.append(mirror);
  frame.style.left = "0px";
  frame.style.top = "0px";

  const paint = (callback: () => void) => {
    const id = requestAnimationFrame(() => {
      paints.delete(id);
      if (active) callback();
    });

    paints.add(id);
  };
  const invalidate = (entry: Entry, discard = false) => {
    entry.version++;
    // A preference change queues behind a running dissolve, not through it.
    if (!entry.pending?.started || discard) {
      entry.pending?.cancelFade?.();
      entry.pending?.controller.abort();
      if (entry.pending) entry.pending.image.src = "";
      entry.pending?.image.remove();
      entry.pending = undefined;
    }
    entry.requested = undefined;
    entry.readyUrl = undefined;
  };
  const releaseDetail = (entry: Entry) => {
    invalidate(entry, true);
    if (entry.image !== entry.previewImage) {
      entry.image.src = "";
      entry.image.remove();
    }
    entry.image = entry.previewImage;
    entry.previewImage.dataset.bufferActive = "true";
  };
  const commit = (entry: Entry) => {
    const pending = entry.pending;

    if (
      !pending?.decoded ||
      pending.started ||
      drag ||
      !entry.visible ||
      !entry.detailSelected ||
      pending.version !== entry.version
    )
      return;
    const previous = entry.image;

    pending.started = true;
    const finish = () => {
      if (!active || entry.pending !== pending) return;
      pending.cancelFade?.();
      if (previous !== entry.previewImage) {
        previous.src = "";
        previous.remove();
      }
      entry.previewImage.dataset.bufferActive = "false";
      entry.image = pending.image;
      entry.image.dataset.bufferActive = "true";
      entry.pending = undefined;
      if (entry.readyUrl && !drag) {
        const url = entry.readyUrl;

        entry.readyUrl = undefined;
        upgrade(entry, url);
      }
    };
    const ended = (event: TransitionEvent) => {
      if (event.target === pending.image && event.propertyName === "opacity")
        finish();
    };
    let timer: ReturnType<typeof setTimeout> | undefined;

    pending.image.addEventListener("transitionend", ended);
    pending.cancelFade = () => {
      clearTimeout(timer);
      pending.image.removeEventListener("transitionend", ended);
    };
    paint(() =>
      paint(() => {
        if (entry.pending !== pending) return;
        pending.image.style.opacity = "1";
        timer = setTimeout(finish, 750);
      }),
    );
  };
  const upgrade = (entry: Entry, url: string) => {
    if (entry.pending?.started) {
      entry.readyUrl = url;

      return;
    }
    if (entry.image.src === url || entry.pending?.url === url) return;
    entry.pending?.controller.abort();
    if (entry.pending) entry.pending.image.src = "";
    entry.pending?.image.remove();
    const image = entry.image.cloneNode(false) as HTMLImageElement;

    image.style.opacity = "0";
    image.style.position = "absolute";
    image.style.zIndex = "2";
    image.style.transition = "opacity 600ms ease-in-out";
    image.fetchPriority = "high";
    image.loading = "eager";
    image.src = url;
    image.dataset.bufferActive = "false";
    image.dataset.hdrActive = String(
      entry.original.dataset.filmHdrEnabled === "true" &&
        url === entry.original.dataset.filmHdrSrc,
    );
    const pending: Pending = {
      image,
      url,
      version: entry.version,
      decoded: false,
      controller: new AbortController(),
    };

    entry.pending = pending;
    entry.image.parentElement?.append(image);
    void decodePhotoElement(
      image,
      4,
      pending.controller.signal,
      PHOTO_LOAD_TIMEOUT_MS,
    )
      .then(() => {
        if (
          !active ||
          entry.pending !== pending ||
          !entry.visible ||
          !entry.detailSelected ||
          pending.version !== entry.version
        ) {
          image.src = "";
          image.remove();

          return;
        }
        pending.decoded = true;
        commit(entry);
      })
      .catch(() => {
        image.src = "";
        image.remove();
        if (entry.pending === pending) {
          entry.pending = undefined;
          entry.requested = undefined;
        }
      });
  };
  const sample = () => {
    const view = getView();
    const pixelRatio = window.devicePixelRatio || 1;

    return loupeSampleCircle(
      {
        ...view,
        x: Math.round(view.x * pixelRatio) / pixelRatio,
        y: Math.round(view.y * pixelRatio) / pixelRatio,
      },
      center.x,
      center.y,
      (diameter - 16) / 2,
      zoom,
    );
  };
  const inspect = () => {
    qualityTimer = undefined;
    // Dragging never starts a high-resolution decode or replaces native images.
    if (!active || drag) return;
    const circle = sample();

    for (const entry of entries) {
      if (
        !entry.visible ||
        !entry.detailSelected ||
        !circleIntersectsRect(
          circle.x,
          circle.y,
          circle.radius,
          entry.imageBounds,
        )
      )
        continue;
      commit(entry);
      if (entry.readyUrl) {
        upgrade(entry, entry.readyUrl);
        entry.readyUrl = undefined;
      }
      if (entry.requested === entry.identity) continue;
      const version = entry.version;

      entry.requested = entry.identity;
      void loadDetail(entry.original)
        .then((url) => {
          if (
            !active ||
            !entry.visible ||
            !entry.detailSelected ||
            version !== entry.version
          )
            return;
          if (!url) {
            entry.requested = undefined;

            return;
          }
          if (drag) entry.readyUrl = url;
          else upgrade(entry, url);
        })
        .catch(() => {
          if (active && version === entry.version) entry.requested = undefined;
        });
    }
  };
  const scheduleQuality = (delay = 120) => {
    if (qualityTimer !== undefined) clearTimeout(qualityTimer);
    qualityTimer = setTimeout(inspect, delay);
  };

  // Layout reads are confined to source-layout changes, never the drag path.
  const measure = () => {
    width = viewport.clientWidth;
    height = viewport.clientHeight;
    const sourceBox = source.getBoundingClientRect();
    const scale = getView().scale;

    for (const entry of entries) {
      const element = entry.source;
      const imageWindow =
        element.querySelector<HTMLElement>(".film-image-window")!;
      const box = element.getBoundingClientRect();
      const imageBox = imageWindow.getBoundingClientRect();
      const x = (box.left - sourceBox.left) / scale;
      const y = (box.top - sourceBox.top) / scale;
      const w = box.width / scale;
      const h = box.height / scale;

      entry.bounds = { left: x, top: y, right: x + w, bottom: y + h };
      const left = (imageBox.left - sourceBox.left) / scale;
      const top = (imageBox.top - sourceBox.top) / scale;

      entry.imageBounds = {
        left,
        top,
        right: left + imageBox.width / scale,
        bottom: top + imageBox.height / scale,
      };
      entry.frame.style.left = `${x}px`;
      entry.frame.style.top = `${y}px`;
    }
  };
  const refreshSources = () => {
    const sourceFrames = [
      ...source.querySelectorAll<HTMLElement>(".film-frame"),
    ];
    const changed =
      sourceFrames.length !== entries.length ||
      sourceFrames.some((element, i) => element !== entries[i].source);

    if (changed) {
      entries.forEach((entry) => invalidate(entry, true));
      mirror.replaceChildren();
      entries = sourceFrames.flatMap((element) => {
        const original = activeImage(element);

        if (!original) return [];
        const copy = document.createElement("span");

        for (const attr of element.attributes) {
          if (!["type", "aria-label"].includes(attr.name))
            copy.setAttribute(attr.name, attr.value);
        }
        copy.append(
          ...[...element.childNodes].map((child) => child.cloneNode(true)),
        );
        copy.style.position = "absolute";
        copy.style.display = "none";
        copy
          .querySelectorAll<HTMLImageElement>(
            '.film-image-window img:not([data-buffer-active="true"])',
          )
          .forEach((image) => image.remove());
        const image = activeImage(copy)!;
        const preview =
          original.currentSrc || original.src || original.dataset.filmThumbSrc!;

        image.src = preview;
        image.style.opacity = "1";
        image.style.zIndex = "1";
        image.dataset.hdrActive = original.dataset.hdrActive ?? "false";
        mirror.append(copy);

        return [
          {
            source: element,
            original,
            frame: copy,
            image,
            previewImage: image,
            bounds: emptyRect(),
            imageBounds: emptyRect(),
            preview,
            identity: identity(original),
            visible: false,
            detailSelected: false,
            version: 0,
          },
        ];
      });
      measure();
    } else {
      for (const entry of entries) {
        const original = activeImage(entry.source);

        if (!original) continue;
        const nextIdentity = identity(original);

        if (nextIdentity !== entry.identity) invalidate(entry);
        entry.original = original;
        entry.identity = nextIdentity;
        const preview = original.currentSrc || original.src;

        if (preview && preview !== entry.preview) {
          entry.preview = preview;
          entry.previewImage.src = preview;
          entry.previewImage.dataset.hdrActive =
            original.dataset.hdrActive ?? "false";
        }
        // React hooks do not run on cloned DOM. Copy the native HDR glyph state
        // only when labels change; never measure, decode or rebuild them on drag.
        const labels = [
          ...entry.source.querySelectorAll<HTMLElement>(".film-edge-label"),
        ];
        const edgeState = labels
          .map(
            (label) =>
              `${label.dataset.edgeText}:${label.dataset.edgeHdrReady}:${label.childElementCount}`,
          )
          .join("|");

        if (edgeState !== entry.edgeState) {
          const copies = [
            ...entry.frame.querySelectorAll<HTMLElement>(".film-edge-label"),
          ];

          labels.forEach((label, index) => {
            const copy = copies[index];

            // Preserve the same native atlas nodes so CSS can reverse a fade.
            if (
              copy &&
              copy.dataset.edgeText === label.dataset.edgeText &&
              copy.childElementCount === label.childElementCount
            ) {
              copy.setAttribute(
                "data-edge-hdr-ready",
                label.dataset.edgeHdrReady ?? "false",
              );
            } else copy?.replaceWith(label.cloneNode(true));
          });
          entry.edgeState = edgeState;
        }
      }
    }
  };

  const render = () => {
    animationFrame = 0;
    const nextDiameter = Math.max(80, Math.min(280, width - 24, height - 100));

    if (diameter !== nextDiameter) {
      diameter = nextDiameter;
      frame.style.width = `${diameter}px`;
      frame.style.height = `${diameter}px`;
    }
    center = boundLoupePosition(center.x, center.y, diameter, width, height);
    const pixelRatio = window.devicePixelRatio || 1;
    const x = Math.round((center.x - diameter / 2) * pixelRatio) / pixelRatio;
    const y = Math.round((center.y - diameter / 2) * pixelRatio) / pixelRatio;

    frame.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    const view = getView();
    const lens = loupeSceneView(
      {
        ...view,
        x: Math.round(view.x * pixelRatio) / pixelRatio,
        y: Math.round(view.y * pixelRatio) / pixelRatio,
      },
      center.x,
      center.y,
      (diameter - 16) / 2,
      zoom,
    );

    mirror.style.transform = `translate3d(${lens.x}px, ${lens.y}px, 0) scale(${lens.scale})`;
    const circle = sample();
    let selectionChanged = false;

    for (const entry of entries) {
      const visible = circleIntersectsRect(
        circle.x,
        circle.y,
        circle.radius,
        entry.bounds,
      );

      if (visible === entry.visible) continue;
      selectionChanged = true;
      entry.visible = visible;
      entry.frame.style.display = visible ? "block" : "none";
      if (!visible) {
        releaseDetail(entry);
      }
    }
    // At very low canvas zoom the glass can contain many frames. Upgrade only
    // the two closest to its center; every other frame keeps its fixed preview.
    const selected = new Set(
      entries
        .filter(
          (entry) =>
            entry.visible &&
            circleIntersectsRect(
              circle.x,
              circle.y,
              circle.radius,
              entry.imageBounds,
            ),
        )
        .sort((a, b) => {
          const distance = (entry: Entry) => {
            const rect = entry.imageBounds;
            const dx = Math.max(rect.left - circle.x, 0, circle.x - rect.right);
            const dy = Math.max(rect.top - circle.y, 0, circle.y - rect.bottom);

            return dx * dx + dy * dy;
          };

          return distance(a) - distance(b);
        })
        .slice(0, MAX_LOUPE_DETAIL_IMAGES),
    );

    for (const entry of entries) {
      const next = selected.has(entry);

      if (entry.detailSelected === next) continue;
      selectionChanged = true;
      if (!next) releaseDetail(entry);
      entry.detailSelected = next;
    }
    if (selectionChanged && !drag) scheduleQuality();
  };
  const queue = () => {
    if (!animationFrame) animationFrame = requestAnimationFrame(render);
  };
  const sceneChanged = () => {
    queue();
    scheduleQuality();
  };
  const adjustZoom = (direction: number) => {
    zoom = Math.max(
      1.5,
      Math.min(6, Math.round((zoom + direction * 0.5) * 2) / 2),
    );
    onMagnification(zoom);
    sceneChanged();
  };
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    glass.focus({ preventScroll: true });
    glass.setPointerCapture(event.pointerId);
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      centerX: center.x,
      centerY: center.y,
    };
    frame.dataset.dragging = "true";
    if (qualityTimer !== undefined) clearTimeout(qualityTimer);
  };
  const pointerMove = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    center = {
      x: drag.centerX + event.clientX - drag.x,
      y: drag.centerY + event.clientY - drag.y,
    };
    queue();
  };
  const pointerEnd = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    drag = undefined;
    delete frame.dataset.dragging;
    if (glass.hasPointerCapture(event.pointerId))
      glass.releasePointerCapture(event.pointerId);
    scheduleQuality(0);
  };
  const keyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") onClose();
    else if (["+", "=", "-"].includes(event.key))
      adjustZoom(event.key === "-" ? -1 : 1);
    else {
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-12, 0],
        ArrowRight: [12, 0],
        ArrowUp: [0, -12],
        ArrowDown: [0, 12],
      };
      const move = moves[event.key];

      if (!move) return;
      center = { x: center.x + move[0], y: center.y + move[1] };
      sceneChanged();
    }
    event.preventDefault();
    event.stopPropagation();
  };
  const observer = new MutationObserver(() => {
    refreshSources();
    sceneChanged();
  });
  const resize = new ResizeObserver(() => {
    measure();
    sceneChanged();
  });

  observer.observe(source, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "src",
      "class",
      "data-film-hdr-enabled",
      "data-film-hdr-src",
      "data-edge-hdr-ready",
      "data-edge-text",
    ],
  });
  resize.observe(viewport);
  glass.addEventListener("pointerdown", pointerDown);
  glass.addEventListener("pointermove", pointerMove);
  glass.addEventListener("pointerup", pointerEnd);
  glass.addEventListener("pointercancel", pointerEnd);
  glass.addEventListener("lostpointercapture", pointerEnd);
  frame.addEventListener("keydown", keyDown);
  refreshSources();
  render();
  scheduleQuality();

  return {
    sceneChanged,
    adjustZoom,
    destroy() {
      active = false;
      cancelAnimationFrame(animationFrame);
      paints.forEach(cancelAnimationFrame);
      if (qualityTimer !== undefined) clearTimeout(qualityTimer);
      entries.forEach((entry) => invalidate(entry, true));
      observer.disconnect();
      resize.disconnect();
      glass.removeEventListener("pointerdown", pointerDown);
      glass.removeEventListener("pointermove", pointerMove);
      glass.removeEventListener("pointerup", pointerEnd);
      glass.removeEventListener("pointercancel", pointerEnd);
      glass.removeEventListener("lostpointercapture", pointerEnd);
      frame.removeEventListener("keydown", keyDown);
      glass.replaceChildren();
    },
  };
}
