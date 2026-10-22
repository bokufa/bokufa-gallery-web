export interface CanvasView {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FILM_WORLD_WIDTH = 1440;
export const FILM_WORLD_HEIGHT = 900;
export const FILM_BOARD_MARGIN = 1440;
export const MIN_FILM_SCALE = 0.3;
export const MAX_FILM_SCALE = 3;

export function zoomFilmView(
  view: CanvasView,
  scale: number,
  x: number,
  y: number,
  minimum = MIN_FILM_SCALE,
): CanvasView {
  const nextScale = Math.max(minimum, Math.min(MAX_FILM_SCALE, scale));
  const ratio = nextScale / view.scale;

  return {
    x: x - (x - view.x) * ratio,
    y: y - (y - view.y) * ratio,
    scale: nextScale,
  };
}

// Board dimensions belong to the scene, never to the shape of the device.
export function minimumFilmScale(
  width: number,
  height: number,
  contentWidth: number,
  contentHeight: number,
) {
  return Math.max(
    MIN_FILM_SCALE,
    width / (contentWidth + 2 * FILM_BOARD_MARGIN),
    height / (contentHeight + 2 * FILM_BOARD_MARGIN),
  );
}

export function boundFilmView(
  view: CanvasView,
  width: number,
  height: number,
  contentWidth: number,
  contentHeight: number,
): CanvasView {
  const scale = Math.max(
    minimumFilmScale(width, height, contentWidth, contentHeight),
    Math.min(MAX_FILM_SCALE, view.scale),
  );
  const bound = (position: number, viewport: number, content: number) => {
    const margin = FILM_BOARD_MARGIN;
    const minimum = viewport - (content + margin) * scale;
    const maximum = margin * scale;

    return Math.max(minimum, Math.min(maximum, position));
  };

  return {
    ...view,
    scale,
    x: bound(view.x, width, contentWidth),
    y: bound(view.y, height, contentHeight),
  };
}

export function defaultFilmView(
  width: number,
  height: number,
  contentWidth: number,
  contentHeight: number,
  firstFrame?: CanvasRect,
  firstRow?: CanvasRect,
): CanvasView {
  const bounds = firstRow ?? {
    x: 0,
    y: 0,
    width: contentWidth,
    height: contentHeight,
  };
  const focusFirst =
    firstFrame && (width < bounds.width * 0.8 || height < bounds.height * 0.8);
  const x = focusFirst
    ? width / 2 - firstFrame.x - firstFrame.width / 2
    : (width - bounds.width) / 2 - bounds.x;
  const y = focusFirst ? height / 2 - firstFrame.y - firstFrame.height / 2 : 0;

  return boundFilmView(
    { x, y, scale: 1 },
    width,
    height,
    contentWidth,
    contentHeight,
  );
}
