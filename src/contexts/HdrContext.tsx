import { createContext, useContext, useState, type ReactNode } from "react";

// Do not inherit the old shared preference that a detail window could change.
const storageKey = "gallery-film-hdr-enabled";
const HdrContext = createContext({ enabled: false, toggle: () => {} });

export function HdrProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setEnabled((current) => {
      const next = !current;

      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        /* Storage may be blocked. */
      }

      return next;
    });

  return (
    <HdrContext.Provider value={{ enabled, toggle }}>
      {children}
    </HdrContext.Provider>
  );
}

export const useHdr = () => useContext(HdrContext);
