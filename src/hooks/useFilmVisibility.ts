import type { RefObject } from "react";

import { useEffect, useRef, useState } from "react";

// One observer per frame controls both its photo and all its edge labels.
// Keep observing during pan/zoom so offscreen native HDR textures can be released.
export default function useFilmVisibility(ref: RefObject<HTMLElement>) {
  const [visible, setVisible] = useState(false);
  const pending = useRef<boolean>();

  useEffect(() => {
    const frame = ref.current;

    if (!frame) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);

      return;
    }
    const root = frame.closest<HTMLElement>(".film-canvas-viewport");
    const flush = () => {
      if (pending.current === undefined) return;
      setVisible(pending.current);
      pending.current = undefined;
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (root?.dataset.filmMoving === "true") {
          pending.current = entry.isIntersecting;

          return;
        }
        setVisible(entry.isIntersecting);
      },
      { root, rootMargin: "0px" },
    );

    observer.observe(frame);
    root?.addEventListener("filmcanvasidle", flush);

    return () => {
      observer.disconnect();
      root?.removeEventListener("filmcanvasidle", flush);
    };
  }, [ref]);

  return visible;
}
