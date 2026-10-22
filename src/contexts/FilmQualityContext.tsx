import type { ReactNode } from "react";

import { createContext, useContext } from "react";

const FilmDetailIdsContext = createContext<ReadonlySet<number>>(new Set());
const FilmCompactModeContext = createContext(false);

export function FilmQualityProvider({
  children,
  compact,
  detailIds,
}: {
  children: ReactNode;
  compact: boolean;
  detailIds: ReadonlySet<number>;
}) {
  return (
    <FilmCompactModeContext.Provider value={compact}>
      <FilmDetailIdsContext.Provider value={detailIds}>
        {children}
      </FilmDetailIdsContext.Provider>
    </FilmCompactModeContext.Provider>
  );
}

export function useFilmDetailQuality(photoId: number) {
  return useContext(FilmDetailIdsContext).has(photoId);
}

export function useFilmCompactMode() {
  return useContext(FilmCompactModeContext);
}
