import type { ReactNode } from "react";

import { createContext, useContext } from "react";

const FilmDetailIdsContext = createContext<ReadonlySet<number>>(new Set());

export function FilmQualityProvider({
  children,
  detailIds,
}: {
  children: ReactNode;
  detailIds: ReadonlySet<number>;
}) {
  return (
    <FilmDetailIdsContext.Provider value={detailIds}>
      {children}
    </FilmDetailIdsContext.Provider>
  );
}

export function useFilmDetailQuality(photoId: number) {
  return useContext(FilmDetailIdsContext).has(photoId);
}
