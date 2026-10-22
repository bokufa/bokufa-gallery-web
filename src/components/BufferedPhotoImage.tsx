import type { ImgHTMLAttributes } from "react";

import { useEffect, useRef, useState } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  hdrSrc?: string;
};

// Never fade the base out: the decoded replacement fades over an opaque image.
// Rapid toggles queue the latest source until the current dissolve finishes.
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
  const [view, setView] = useState({ base: src, incoming: "", fading: false });
  const current = useRef(view);
  const desired = useRef(src);
  const mounted = useRef(true);
  const frames = useRef(new Set<number>());
  const elements = useRef(new Map<string, HTMLImageElement>());
  const bindings = useRef(
    new Map<string, (element: HTMLImageElement | null) => void>(),
  );
  const ready = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout>>();

  desired.current = src;

  const bind = (url: string) => {
    if (!bindings.current.has(url))
      bindings.current.set(url, (element) => {
        if (element) elements.current.set(url, element);
        else {
          elements.current.delete(url);
          ready.current.delete(url);
        }
      });
    return bindings.current.get(url)!;
  };

  const paint = (callback: () => void) => {
    const id = requestAnimationFrame(() => {
      frames.current.delete(id);
      if (mounted.current) callback();
    });

    frames.current.add(id);
  };
  const update = (next: typeof view) => {
    current.current = next;
    setView(next);
  };
  const finish = (url: string) => {
    if (
      !mounted.current ||
      current.current.incoming !== url ||
      !current.current.fading
    )
      return;
    clearTimeout(timer.current);
    update({ base: url, incoming: "", fading: false });
    setUrls((values) =>
      values.filter((value) => value === url || value === desired.current),
    );
  };
  const show = (url: string) => {
    if (
      !mounted.current ||
      desired.current !== url ||
      current.current.incoming ||
      current.current.base === url
    )
      return;
    update({ ...current.current, incoming: url, fading: false });
    // A cached image still needs an opacity-zero paint before every fade-in.
    paint(() =>
      paint(() => {
        if (current.current.incoming !== url) return;
        update({ ...current.current, fading: true });
        timer.current = setTimeout(() => finish(url), 750);
      }),
    );
  };

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      frames.current.forEach(cancelAnimationFrame);
      frames.current.clear();
    };
  }, []);

  useEffect(() => {
    setUrls([
      ...new Set(
        [current.current.base, current.current.incoming, src].filter(Boolean),
      ),
    ]);
    if (ready.current.has(src) && elements.current.has(src)) show(src);
  }, [src, view.base, view.incoming]);

  return (
    <span className="buffered-photo" style={style}>
      {urls.map((url) => (
        <img
          {...props}
          key={url}
          ref={bind(url)}
          alt={url === view.base ? alt : ""}
          aria-hidden={url !== view.base}
          className={`${className} buffered-photo-layer ${url === view.base ? "is-current" : ""}`}
          data-buffer-active={url === view.base}
          data-hdr-active={url === hdrSrc}
          src={url}
          style={{
            ...style,
            zIndex: url === view.base ? 1 : 2,
            opacity:
              url === view.base || (url === view.incoming && view.fading)
                ? 1
                : 0,
          }}
          onTransitionEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.propertyName === "opacity"
            )
              finish(url);
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
