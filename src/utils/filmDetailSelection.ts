export const FILM_DETAIL_SCALE_THRESHOLD = 2;
export const MAX_FILM_DETAIL_IMAGES = 3;

export interface FilmDetailCandidate {
  id: number;
  distance: number;
}

export interface FilmDetailPlan {
  ids: Set<number>;
  waitForRelease: boolean;
}

// Detail images are sticky: zooming out does not churn decoded images. At high
// zoom only a missing, nearer candidate can evict an older detail texture.
export function planFilmDetailSelection(
  current: ReadonlySet<number>,
  candidates: readonly FilmDetailCandidate[],
  scale: number,
): FilmDetailPlan {
  if (scale < FILM_DETAIL_SCALE_THRESHOLD)
    return { ids: new Set(current), waitForRelease: false };

  const preferred = [...candidates]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_FILM_DETAIL_IMAGES);
  const missing = preferred.find(({ id }) => !current.has(id));

  if (!missing) return { ids: new Set(current), waitForRelease: false };
  if (current.size < MAX_FILM_DETAIL_IMAGES) {
    const ids = new Set(current);

    ids.add(missing.id);

    return { ids, waitForRelease: false };
  }

  const preferredIds = new Set(preferred.map(({ id }) => id));
  const distance = new Map(
    candidates.map((candidate) => [candidate.id, candidate.distance]),
  );
  const victim = [...current].sort((a, b) => {
    const aPreferred = preferredIds.has(a) ? 1 : 0;
    const bPreferred = preferredIds.has(b) ? 1 : 0;

    if (aPreferred !== bPreferred) return aPreferred - bPreferred;

    return (distance.get(b) ?? Infinity) - (distance.get(a) ?? Infinity);
  })[0];
  const ids = new Set(current);

  if (victim !== undefined) ids.delete(victim);

  // The caller waits for React to unmount the victim before asking for the
  // replacement, so the native high-resolution image count never exceeds cap.
  return { ids, waitForRelease: true };
}
