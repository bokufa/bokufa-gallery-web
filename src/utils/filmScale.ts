// The enlarged visual baseline is displayed as 100%, independently of user zoom.
export const FILM_PIXELS_PER_MM = 5.02 * 1.5;

export function filmSceneWidth(pixelsPerMm = FILM_PIXELS_PER_MM) {
  // Two margins, four 120 frames, three gaps and a rounding allowance.
  return 200 + 4 * 61.5 * pixelsPerMm + 60 + 1;
}
