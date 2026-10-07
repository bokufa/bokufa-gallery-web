import { useState } from "react";

interface FilmLogo {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const filmLogos: Record<string, FilmLogo> = {
  PORTRA160: {
    src: "/film-logos/kodak-portra-160.webp",
    alt: "Kodak Professional Portra 160",
    width: 160,
    height: 160,
  },
  PORTRA400: {
    src: "/film-logos/kodak-portra-400.webp",
    alt: "Kodak Professional Portra 400",
    width: 160,
    height: 160,
  },
  C200: {
    src: "/film-logos/fujicolor-c200.webp",
    alt: "FUJIFILM Fujicolor C200",
    width: 160,
    height: 160,
  },
  FUJICOLOR100: {
    src: "/film-logos/fujicolor-100.webp",
    alt: "FUJIFILM Fujicolor 100",
    width: 160,
    height: 160,
  },
  PROVIA100F: {
    src: "/film-logos/fujichrome-provia-100f.webp",
    alt: "FUJIFILM Fujichrome Provia 100F",
    width: 160,
    height: 160,
  },
};

function filmLogoKey(stock: string) {
  const compact = stock
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[®™]/g, "")
    .replace(/[^A-Z0-9]+/g, "");

  if (/^(?:KODAK)?PORTRA160$/.test(compact)) return "PORTRA160";
  if (/^(?:KODAK)?PORTRA400$/.test(compact)) return "PORTRA400";
  if (/^(?:FUJI|FUJIFILM|FUJICOLOR|FUJICOLORFILM)C200$/.test(compact)) return "C200";
  if (/^(?:FUJI|FUJIFILM|FUJICOLOR|FUJICOLORFILM)100$/.test(compact)) return "FUJICOLOR100";
  if (/^(?:FUJI|FUJIFILM|FUJICHROME)?PROVIA100F$/.test(compact)) return "PROVIA100F";
  return undefined;
}

export function resolveFilmLogo(stock?: string) {
  if (!stock?.trim()) return undefined;
  const key = filmLogoKey(stock.trim());
  return key ? filmLogos[key] : undefined;
}

export default function FilmInfo({ stock }: { stock?: string }) {
  const [failedSource, setFailedSource] = useState<string>();
  if (!stock) return null;
  const logo = resolveFilmLogo(stock);

  return (
    <span className="inline-flex h-5 items-center gap-2 text-small leading-5">
      <span aria-hidden="true" className="text-default-300 font-extralight">｜</span>
      {logo && failedSource !== logo.src ? (
        <img
          src={logo.src}
          alt={logo.alt}
          title={stock}
          width={logo.width}
          height={logo.height}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(logo.src)}
          className="block h-5 w-auto shrink-0 rounded-sm object-contain"
        />
      ) : <span>{stock}</span>}
    </span>
  );
}
