import type { CanvasView } from "./filmCanvas";

export function loupeSceneView(
  view: CanvasView,
  centerX: number,
  centerY: number,
  radius: number,
  magnification: number,
): CanvasView {
  return {
    x: radius + (view.x - centerX) * magnification,
    y: radius + (view.y - centerY) * magnification,
    scale: view.scale * magnification,
  };
}

export function circleIntersectsRect(
  x: number,
  y: number,
  radius: number,
  rect: { left: number; top: number; right: number; bottom: number },
) {
  const nearestX = Math.max(rect.left, Math.min(rect.right, x));
  const nearestY = Math.max(rect.top, Math.min(rect.bottom, y));

  return (nearestX - x) ** 2 + (nearestY - y) ** 2 <= radius ** 2;
}

// Sampling in fixed scene coordinates avoids reading screen rectangles on drag.
export function loupeSampleCircle(
  view: CanvasView,
  centerX: number,
  centerY: number,
  radius: number,
  magnification: number,
) {
  return {
    x: (centerX - view.x) / view.scale,
    y: (centerY - view.y) / view.scale,
    radius: radius / (magnification * view.scale),
  };
}

export function boundLoupePosition(
  x: number,
  y: number,
  diameter: number,
  width: number,
  height: number,
) {
  const inset = diameter / 2 + 8;

  return {
    x: Math.max(inset, Math.min(width - inset, x)),
    y: Math.max(inset, Math.min(height - inset, y)),
  };
}
