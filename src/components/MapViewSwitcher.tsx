import { Tab, Tabs } from "@heroui/react";
import type { Key } from "react";
import { TbMap, TbPhotoPin } from "react-icons/tb";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import FloatingControls, { floatingControlSurface } from "./FloatingControls";

export type MapView = "regions" | "photos";

interface MapViewSwitcherProps {
  view: MapView;
  isHidden?: boolean;
}

export default function MapViewSwitcher({ view, isHidden = false }: MapViewSwitcherProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const switchView = (key: Key) => {
    if (key === view) return;
    const params = new URLSearchParams(window.location.search);
    if (key === "photos") params.set("view", "photos");
    else params.delete("view");
    const search = params.toString();
    navigate({ pathname: "/map", search: search ? `?${search}` : "" });
  };

  return (
    <FloatingControls isHidden={isHidden}>
      <Tabs
        aria-label={t("map.view")}
        selectedKey={view}
        onSelectionChange={switchView}
        size="lg"
        radius="lg"
        classNames={{
          base: isHidden ? "pointer-events-none" : "pointer-events-auto",
          tabList: floatingControlSurface,
        }}
      >
        <Tab
          key="regions"
          title={(
            <span className="flex items-center gap-1.5">
              <TbMap aria-hidden="true" size={17} />
              <span>{t("map.regions")}</span>
            </span>
          )}
        />
        <Tab
          key="photos"
          title={(
            <span className="flex items-center gap-1.5">
              <TbPhotoPin aria-hidden="true" size={17} />
              <span>{t("map.photos")}</span>
            </span>
          )}
        />
      </Tabs>
    </FloatingControls>
  );
}
