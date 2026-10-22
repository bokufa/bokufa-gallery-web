import { createContext, useContext, useState, type ReactNode } from "react";

const HdrContext = createContext({ enabled: false, toggle: () => {} });

export function HdrProvider({ children }: { children: ReactNode }) {
  // Every new page load starts from the standard rendition. HDR remains an
  // explicit viewing choice for the current session instead of a saved default.
  const [enabled, setEnabled] = useState(false);
  const toggle = () => setEnabled((current) => !current);

  return (
    <HdrContext.Provider value={{ enabled, toggle }}>
      {children}
    </HdrContext.Provider>
  );
}

export const useHdr = () => useContext(HdrContext);
