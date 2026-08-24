import { Button, Chip, Select, SelectItem } from "@heroui/react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { TbMap } from "react-icons/tb";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import PhotoMasonry from "../components/PhotoMasonry";
import type { Photo } from "../models/gallery";
import { fetchPhotos } from "../services/photos";

interface PrefectureLocationState {
  prefectureName?: string;
}

export default function PrefecturePage() {
  const { prefectureId, cityId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as PrefectureLocationState | null;
  const [regionPhotos, setRegionPhotos] = useState<Photo[]>();

  useEffect(() => {
    if (!prefectureId) return;
    let cancelled = false;
    setRegionPhotos(undefined);
    void fetchPhotos({ page_size: 2_000, prefecture_id: prefectureId }).then((photos) => {
      if (!cancelled) setRegionPhotos(photos);
    });
    return () => {
      cancelled = true;
    };
  }, [prefectureId]);

  const cities = useMemo(() => {
    const byId = new Map<number, { id: number; name: string; photos_count: number }>();
    for (const photo of regionPhotos || []) {
      const city = photo.metadata.city;
      if (!city) continue;
      const existing = byId.get(city.id);
      byId.set(city.id, {
        id: city.id,
        name: city.name,
        photos_count: (existing?.photos_count || 0) + 1,
      });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }, [regionPhotos]);

  if (!prefectureId || !regionPhotos) return null;
  const prefectureName = routeState?.prefectureName
    || regionPhotos[0]?.metadata.city?.prefecture.name
    || "地区";
  const areas = [
    { id: 0, name: `${prefectureName}全部区域`, photos_count: regionPhotos.length },
    ...cities,
  ];

  return (
    <motion.div
      className="relative z-10 md:pl-4"
      initial={{ opacity: 0, y: 24 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
      }}
      exit={{
        opacity: 0,
        pointerEvents: "none",
        transition: { duration: 0.2, ease: "easeIn" },
      }}
    >
      <div className="px-2 pb-12 pt-4">
        <Button
          size="sm"
          variant="flat"
          className="mb-2 ml-2 mt-1"
          startContent={<TbMap size={16} />}
          onPress={() => navigate("/map")}
        >
          返回地图
        </Button>

        <div className="mb-4 ml-2 pt-2 text-5xl md:mb-6">
          {prefectureName}
        </div>

        <div className="mb-8 md:mb-12">
          <Select
            label="城市"
            selectedKeys={[cityId ?? "0"]}
            onChange={(event) => {
              const path = event.target.value === "0"
                ? `/map/prefecture/${prefectureId}`
                : `/map/prefecture/${prefectureId}/city/${event.target.value}`;
              navigate(path, { state: routeState });
            }}
          >
            {areas.map((area) => (
              <SelectItem
                key={area.id}
                textValue={area.name}
                endContent={<Chip>{area.photos_count}</Chip>}
              >
                {area.name}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div>
          {!cityId ? (
            <PhotoMasonry prefectureId={prefectureId} key="0" />
          ) : (
            <PhotoMasonry cityId={cityId} key={cityId} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
