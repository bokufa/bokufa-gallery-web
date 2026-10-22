// The compact visual baseline is 65% of the previous size, still labeled 100%.
// Both film formats, their borders and lettering use this same physical unit.
export const FILM_PIXELS_PER_MM = 5.02 * 1.5 * 0.65;

export function filmSceneWidth(pixelsPerMm = FILM_PIXELS_PER_MM) {
  // Two margins, four 120 frames, three gaps and a rounding allowance.
  return 200 + 4 * 61.5 * pixelsPerMm + 60 + 1;
}
