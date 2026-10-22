// One even-odd vector path keeps the strip pure black while cutting real holes
// through to the SDR/HDR light table. No masks, duplicated IDs or painted white holes.
export function filmPerforations(portrait = false) {
  const pitch = (38 - 2 * 0.95 - 2.8) / 7;

  return [0.75, 35 - 0.75 - 2].flatMap((y) =>
    Array.from({ length: 8 }, (_, index) => {
      const x = 0.95 + index * pitch;

      return portrait
        ? { x: 35 - y - 2, y: x, width: 2, height: 2.8 }
        : { x, y, width: 2.8, height: 2 };
    }),
  );
}

export default function FilmStripBase({
  portrait = false,
}: {
  portrait?: boolean;
}) {
  const width = portrait ? 35 : 38;
  const height = portrait ? 38 : 35;
  const holes = filmPerforations(portrait).map(
    ({ x, y, width: w, height: h }) => {
      const r = 0.25;

      return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
    },
  );

  return (
    <svg
      aria-hidden="true"
      className="film-strip-base"
      data-film-sprockets="true"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        d={`M0 0H${width}V${height}H0Z${holes.join("")}`}
        fill="#000"
        fillRule="evenodd"
      />
    </svg>
  );
}
