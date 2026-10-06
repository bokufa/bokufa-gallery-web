import { useState } from "react";
import type { FilmMetadata } from "../models/gallery";

export default function FilmInfo({ film }: { film: FilmMetadata }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!film.stock && !film.scanner) return null;
  const isC200 = /^(?:FUJI|FUJIFILM|FUJICOLOR)\s+C200$/i.test(film.stock?.trim() || "");

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-relaxed">
      {isC200 && !imageFailed ? (
        <img
          src="/film-logos/fujicolor-c200.jpg"
          alt="FUJIFILM FUJICOLOR C200"
          title={`胶片 ${film.stock}`}
          width={817}
          height={459}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
          className="block h-auto w-36 max-w-full shrink-0 rounded-sm object-contain"
        />
      ) : film.stock ? <span>胶片 {film.stock}</span> : null}
      {film.scanner ? <span>扫描 {film.scanner}</span> : null}
    </div>
  );
}
