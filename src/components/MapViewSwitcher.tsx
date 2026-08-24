import { Tab, Tabs } from "@heroui/react";
import type { Key } from "react";
import { TbMap, TbPhotoPin } from "react-icons/tb";
import { useNavigate } from "react-router-dom";

export type MapView = "regions" | "photos";

interface MapViewSwitcherProps {
  view: MapView;
  isHidden?: boolean;
}

export default function MapViewSwitcher({ view, isHidden = false }: MapViewSwitcherProps) {
  const navigate = useNavigate();

  const switchView = (key: Key) => {
    if (key === view) return;
    const params = new URLSearchParams(window.location.search);
    if (key === "photos") params.set("view", "photos");
    else params.delete("view");
    const search = params.toString();
    navigate({ pathname: "/map", search: search ? `?${search}` : "" });
  };

  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center transition-[opacity,visibility] duration-300 ${
      isHidden ? "invisible opacity-0" : "visible opacity-100"
    }`}>
      <Tabs
        aria-label="地图显示方式"
        selectedKey={view}
        onSelectionChange={switchView}
        size="lg"
        radius="lg"
        classNames={{
          base: isHidden ? "pointer-events-none" : "pointer-events-auto",
          tabList: "bg-content1/80 shadow-medium backdrop-blur-md",
        }}
      >
        <Tab
          key="regions"
          title={(
            <span className="flex items-center gap-1.5">
              <TbMap aria-hidden="true" size={17} />
              <span>地区</span>
            </span>
          )}
        />
        <Tab
          key="photos"
          title={(
            <span className="flex items-center gap-1.5">
              <TbPhotoPin aria-hidden="true" size={17} />
              <span>照片</span>
            </span>
          )}
        />
      </Tabs>
    </div>
  );
}
