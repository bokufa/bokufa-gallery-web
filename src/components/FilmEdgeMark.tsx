import { useEffect, useRef, useState } from "react";

import { useHdr } from "../contexts/HdrContext";
import {
  filmGlyphs,
  FILM_GLYPH_ORDER,
  FILM_GLYPH_COLUMNS,
  FILM_GLYPH_ROWS,
  FILM_EDGE_HDR_SRC,
} from "../utils/filmGlyphs";

export default function FilmEdgeMark({ text }: { text: string }) {
  const { enabled } = useHdr();
  const letters = [...text.toUpperCase()];
  const [ready, setReady] = useState(false);
  const [activated, setActivated] = useState(enabled);
  const images = useRef(new Map<number, HTMLImageElement>());

  useEffect(() => {
    if (enabled) setActivated(true);
  }, [enabled]);

  useEffect(() => {
    let active = true;
    const frames = new Set<number>();

    setReady(false);
    if (!activated) return;

    // Decode the real image nodes, then allow two paint frames before hiding
    // the vector fallback. One native HDR atlas is shared by every edge label.
    const paint = (callback: () => void) => {
      const id = requestAnimationFrame(() => {
        frames.delete(id);
        if (active) callback();
      });

      frames.add(id);
    };

    void Promise.all(
      [...images.current.values()].map((image) => image.decode()),
    )
      .then(() => {
        if (active) paint(() => paint(() => setReady(true)));
      })
      .catch(() => undefined);

    return () => {
      active = false;
      frames.forEach(cancelAnimationFrame);
    };
  }, [activated, text]);

  return (
    <span
      aria-hidden="true"
      className="film-edge-label"
      data-edge-hdr-ready={enabled && ready}
      data-edge-text={text}
      style={{ aspectRatio: `${Math.max(1, letters.length * 6 - 1)} / 7` }}
    >
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
      {enabled || activated ? (
        <span className="film-edge-hdr">
          {letters.map((letter, index) => {
            const glyph = FILM_GLYPH_ORDER.indexOf(letter);

            return (
              <span key={index} className="film-edge-hdr-cell">
                {glyph >= 0 ? (
                  <img
                    ref={(image) => {
                      if (image) images.current.set(index, image);
                      else images.current.delete(index);
                    }}
                    alt=""
                    data-hdr-active="true"
                    decoding="async"
                    draggable={false}
                    src={FILM_EDGE_HDR_SRC}
                    style={{
                      width: `${((FILM_GLYPH_COLUMNS * 6) / 5) * 100}%`,
                      height: `${((FILM_GLYPH_ROWS * 8) / 7) * 100}%`,
                      left: `${((-(glyph % FILM_GLYPH_COLUMNS) * 6) / 5) * 100}%`,
                      top: `${((-Math.floor(glyph / FILM_GLYPH_COLUMNS) * 8) / 7) * 100}%`,
                    }}
                  />
                ) : null}
              </span>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}
