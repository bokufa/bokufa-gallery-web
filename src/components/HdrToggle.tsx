import { useHdr } from "../contexts/HdrContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function HdrToggle({
  enabled: localEnabled,
  onToggle,
}: { enabled?: boolean; onToggle?: () => void } = {}) {
  const table = useHdr();
  const { t } = useLanguage();
  const enabled = localEnabled ?? table.enabled;
  const toggle = onToggle ?? table.toggle;

  return (
    <button
      aria-label={t("hdr.label")}
      aria-pressed={enabled}
      className="hdr-toggle"
      title={t("hdr.hint")}
      type="button"
      onClick={toggle}
    >
      HDR
    </button>
  );
}
