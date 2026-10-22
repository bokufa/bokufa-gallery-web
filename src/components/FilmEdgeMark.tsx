import { memo, useEffect, useRef, useState } from "react";

import { useHdr } from "../contexts/HdrContext";
import { decodePhotoElement } from "../utils/photoSources";
import { filmGlyphs, FILM_EDGE_HDR_LABELS } from "../utils/filmGlyphs";

// Thousands of fallback dots do not need reconciling on every HDR/ready update.
const EdgeDots = memo(function EdgeDots({ text }: { text: string }) {
  const letters = [...text.toUpperCase()];

  return (
    <svg
      aria-hidden="true"
      className="film-edge-dots"
      fill="currentColor"
      viewBox={`0 0 ${Math.max(1, letters.length * 6 - 1)} 7`}
    >
      {letters.map((letter, index) =>
        (filmGlyphs[letter] ?? []).flatMap((row, y) =>
          [...row].map((dot, x) =>
            dot === "1" ? (
              <circle
                key={`${index}-${x}-${y}`}
                cx={index * 6 + x + 0.5}
                cy={y + 0.5}
                r={0.42}
              />
            ) : null,
          ),
        ),
      )}
    </svg>
  );
});

export default function FilmEdgeMark({
  text,
  active = true,
}: {
  text: string;
  active?: boolean;
}) {
  const { enabled } = useHdr();
  const letters = [...text.toUpperCase()];
  const columns = Math.max(1, letters.length * 6 - 1);
  const [ready, setReady] = useState(false);
  const [settled, setSettled] = useState(false);
  const [retained, setRetained] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const src = FILM_EDGE_HDR_LABELS[text.toUpperCase()];
  const showImage = active && Boolean(src) && (enabled || retained);

  useEffect(() => {
    if (!active || !src) {
      setRetained(false);

      return;
    }
    if (enabled) {
      setRetained(true);

      return;
    }
    // Keep the actual pixels for the closing fade, then release the HDR image.
    const timer = setTimeout(() => setRetained(false), 650);

    return () => clearTimeout(timer);
  }, [enabled, active, src]);

  useEffect(() => {
    let active = true;
    const frames = new Set<number>();
    const controller = new AbortController();

    setReady(false);
    if (!showImage || !image.current) return;

    // One small whole-label native image, with a bounded decode queue.
    const paint = (callback: () => void) => {
      const id = requestAnimationFrame(() => {
        frames.delete(id);
        if (active) callback();
      });

      frames.add(id);
    };

    // Finish the tiny light-up labels before background photo downloads.
    void decodePhotoElement(image.current, 3, controller.signal)
      .then(() => {
        if (active) paint(() => paint(() => setReady(true)));
      })
      .catch(() => undefined);

    return () => {
      active = false;
      controller.abort();
      frames.forEach(cancelAnimationFrame);
    };
  }, [showImage, src]);

  useEffect(() => {
    setSettled(false);
    if (!active || !enabled || !ready) return;

    // WebKit can retain an SDR compositor texture after an HDR image opacity
    // transition. Rebuild the label without an active transition once the
    // light-up fade is complete, while preserving that fade on every toggle.
    const timer = setTimeout(() => setSettled(true), 650);

    return () => clearTimeout(timer);
  }, [active, enabled, ready]);

  return (
    <span
      aria-hidden="true"
      className="film-edge-label"
      data-edge-hdr-ready={active && enabled && ready}
      data-edge-hdr-settled={active && enabled && ready && settled}
      data-edge-text={text}
      style={{
        // Avoid WebKit's cyclic max-content sizing for a percentage-width SVG
        // inside a rotated, auto-width flex item. The loupe did not hit this
        // path because it lays film out again at its final magnified size.
        width: `calc(var(--film-mm) * ${(1.15 * columns) / 7})`,
        aspectRatio: `${columns} / 7`,
      }}
    >
      <EdgeDots text={text} />
      {showImage ? (
        <img
          ref={image}
          alt=""
          className="film-edge-hdr"
          data-hdr-active="true"
          decoding="async"
          draggable={false}
          height={112}
          src={src}
          width={letters.length * 96 - 16}
        />
      ) : null}
    </span>
  );
}
