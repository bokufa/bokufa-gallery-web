import type { ImgHTMLAttributes } from "react";

import { useEffect, useRef, useState } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  hdrSrc?: string;
};

// Decode the actual DOM image, not just a detached preload. Keep the previous
// opaque image underneath until the replacement has had two paint frames.
export default function BufferedPhotoImage({
  src,
  hdrSrc,
  alt = "",
  onLoad,
  className = "",
  style,
  ...props
}: Props) {
  const [urls, setUrls] = useState([src]);
  const [active, setActive] = useState(src);
  const desired = useRef(src);
  const mounted = useRef(true);
  const frames = useRef(new Set<number>());
  const elements = useRef(new Map<string, HTMLImageElement>());
  const ready = useRef(new Set<string>());

  desired.current = src;

  const paint = (callback: () => void) => {
    const id = requestAnimationFrame(() => {
      frames.current.delete(id);
      if (mounted.current) callback();
    });

    frames.current.add(id);
  };
  const show = (url: string) => {
    if (!mounted.current || desired.current !== url) return;
    setActive(url);
    paint(() =>
      paint(() => {
        setUrls((current) =>
          current.filter((value) => value === url || value === desired.current),
        );
      }),
    );
  };

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      frames.current.forEach(cancelAnimationFrame);
      frames.current.clear();
    };
  }, []);

  useEffect(() => {
    setUrls((current) => (current.includes(src) ? current : [...current, src]));
    if (ready.current.has(src) && elements.current.has(src)) show(src);
  }, [src]);

  return (
    <span className="buffered-photo" style={style}>
      {urls.map((url) => (
        <img
          {...props}
          key={url}
          ref={(element) => {
            if (element) elements.current.set(url, element);
            else elements.current.delete(url);
          }}
          alt={url === active ? alt : ""}
          aria-hidden={url !== active}
          className={`${className} buffered-photo-layer ${url === active ? "is-current" : ""}`}
          data-buffer-active={url === active}
          data-hdr-active={url === hdrSrc}
          src={url}
          style={{
            ...style,
            zIndex: url === active ? 2 : 1,
            opacity: url === active || ready.current.has(url) ? 1 : 0,
            transition: "none",
          }}
          onLoad={(event) => {
            const element = event.currentTarget;

            // React's event is only forwarded synchronously; decoding owns the node.
            onLoad?.(event);
            void element
              .decode()
              .then(() => {
                if (!mounted.current || elements.current.get(url) !== element)
                  return;
                ready.current.add(url);
                show(url);
              })
              .catch(() => undefined);
          }}
        />
      ))}
    </span>
  );
}
