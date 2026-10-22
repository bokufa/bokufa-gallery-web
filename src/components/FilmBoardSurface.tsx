import { useEffect, useRef } from "react";

// Keep the texture bitmap bounded. The canvas is stretched with the film
// world, so mobile browsers never need to rasterize the entire 4K+ CSS board.
export const FILM_BOARD_TEXTURE_SIZE = 1024;

function paintBoard(canvas: HTMLCanvasElement, mode: "sdr" | "hdr") {
  const context = canvas.getContext("2d");

  if (!context) return;
  const size = FILM_BOARD_TEXTURE_SIZE;

  context.clearRect(0, 0, size, size);
  const vignette = context.createRadialGradient(
    size * 0.5,
    size * 0.42,
    size * 0.12,
    size * 0.5,
    size * 0.42,
    size * 0.72,
  );

  if (mode === "sdr") {
    vignette.addColorStop(0, "#fafaf8");
    vignette.addColorStop(0.48, "#fafaf8");
    vignette.addColorStop(0.72, "#f6f6f4");
    vignette.addColorStop(1, "#e7e7e3");
  } else {
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(0.6, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.055)");
  }
  context.fillStyle = vignette;
  context.fillRect(0, 0, size, size);

  if (mode === "sdr") {
    // Subtle deterministic grain replaces the old full-size repeating CSS
    // gradients without introducing another composited surface.
    context.fillStyle = "rgba(40, 40, 38, 0.018)";
    for (let y = 3; y < size; y += 7) context.fillRect(0, y, size, 1);
    context.fillStyle = "rgba(40, 40, 38, 0.014)";
    for (let x = 5; x < size; x += 11) context.fillRect(x, 0, 1, size);
  }
}

export default function FilmBoardSurface() {
  const sdrRef = useRef<HTMLCanvasElement>(null);
  const hdrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (sdrRef.current) paintBoard(sdrRef.current, "sdr");
    if (hdrRef.current) paintBoard(hdrRef.current, "hdr");
  }, []);

  return (
    <span aria-hidden="true" className="film-board-surface">
      <canvas
        ref={sdrRef}
        className="film-board-texture film-board-texture-sdr"
        height={FILM_BOARD_TEXTURE_SIZE}
        width={FILM_BOARD_TEXTURE_SIZE}
      />
      <canvas
        ref={hdrRef}
        className="film-board-texture film-board-texture-hdr"
        height={FILM_BOARD_TEXTURE_SIZE}
        width={FILM_BOARD_TEXTURE_SIZE}
      />
    </span>
  );
}
