import type { Photo } from "../models/gallery";

// Every dimension uses the same canvas unit, so formats retain their relative size.
export function filmGeometry(photo: Photo) {
  const ratio = photo.thumb_file.width / photo.thumb_file.height;
  const square = ratio >= 0.85 && ratio <= 1.15;
  const format = square ? "120" : "135";
  const portrait = !square && ratio < 1;

  return {
    format,
    portrait,
    imageWidth: square ? 56 : portrait ? 24 : 36,
    imageHeight: square ? 56 : portrait ? 36 : 24,
    frameWidth: square ? 61.5 : portrait ? 35 : 38,
    frameHeight: square ? 61.5 : portrait ? 38 : 35,
  } as const;
}

export function filmEdgeLabel(stock: string) {
  const compact = stock.toUpperCase().replace(/[\s-]+/g, "");

  if (/RDP(?:3|III)|PROVIA100F/.test(compact)) return "RDP III";
  if (/C200/.test(compact)) return "FUJICOLOR C200";

  return stock.toUpperCase();
}
