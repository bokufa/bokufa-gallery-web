import type { RefObject } from "react";

import { useEffect, useState } from "react";

// One observer per frame controls both its photo and all its edge labels.
// Keep observing during pan/zoom so offscreen native HDR textures can be released.
export default function useFilmVisibility(ref: RefObject<HTMLElement>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = ref.current;

    if (!frame) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);

      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      { root: frame.closest(".film-canvas-viewport"), rootMargin: "0px" },
    );

    observer.observe(frame);

    return () => observer.disconnect();
  }, [ref]);

  return visible;
}
