import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readUiLanguage,
  translateUi,
  UI_LANGUAGE_KEY,
  type UiLanguage,
  type UiMessageKey,
} from "../data/uiMessages";

type Translate = (
  key: UiMessageKey,
  values?: Record<string, string | number>,
) => string;
interface LanguageContextValue {
  language: UiLanguage;
  setLanguage: (language: UiLanguage) => void;
  t: Translate;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "zh-CN",
  setLanguage: () => undefined,
  t: (key, values) => translateUi("zh-CN", key, values),
});

function initialLanguage(): UiLanguage {
  try {
    return readUiLanguage(
      typeof window === "undefined" ? undefined : window.localStorage,
    );
  } catch {
    return "zh-CN";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<UiLanguage>(initialLanguage);
  const t = useCallback<Translate>(
    (key, values) => translateUi(language, key, values),
    [language],
  );
  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(UI_LANGUAGE_KEY, language);
    } catch {
      // Language switching still works when browser storage is unavailable.
    }
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
