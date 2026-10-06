import { useState } from "react";

export default function FilmInfo({ stock }: { stock?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!stock) return null;
  const isC200 = /^(?:FUJI|FUJIFILM|FUJICOLOR)\s+C200$/i.test(stock.trim());

  return (
    <span className="inline-flex h-5 items-center gap-2 text-small leading-5">
      <span aria-hidden="true" className="text-default-300 font-extralight">｜</span>
      {isC200 && !imageFailed ? (
        <img
          src="/film-logos/fujicolor-c200.jpg"
          alt="FUJIFILM FUJICOLOR C200"
          title={stock}
          width={817}
          height={459}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
          className="block h-5 w-auto shrink-0 rounded-sm object-contain"
        />
      ) : <span>{stock}</span>}
    </span>
  );
}
