import { Button, Spinner } from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import mapboxgl from "mapbox-gl";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { TbRefresh } from "react-icons/tb";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  buildClusterElement,
  buildSingleElement,
  clusterFlightTarget,
  createClusterController,
  easeInOutCubic,
  flightDuration,
} from "../components/clusterMapCore";
import type { ClusterController, ClusterPoint } from "../components/clusterMapCore";
import MapViewSwitcher from "../components/MapViewSwitcher";
import type { MapView } from "../components/MapViewSwitcher";
import PhotoModal from "../components/PhotoModal";
import RegionsMap from "./RegionsMap";
import { MapTokenContext, MapType } from "../contexts/MapToken";
import type { Photo, PhotoClusterItem } from "../models/gallery";
import { fetchMapboxToken, isCanceledMapRequest } from "../services/map";
import { fetchMapPhotos, isCanceledPhotoRequest } from "../services/photos";
import { applyChineseMapLabels } from "../utils/mapbox";

import "mapbox-gl/dist/mapbox-gl.css";

type LoadState = "loading" | "ready" | "error";

const JAPAN_INITIAL_CENTER: [number, number] = [137.5, 36.2];
const JAPAN_INITIAL_ZOOM = 5.5;

interface MapPageProps {
  isActive: boolean;
  overlayActive: boolean;
}

function createMapboxClusterController(
  map: mapboxgl.Map,
  onPhotoTap: (photo: PhotoClusterItem) => void,
): ClusterController {
  const zoom256 = () => map.getZoom() + 1;

  const flyToCluster = (cluster: ClusterPoint) => {
    const container = map.getContainer();
    const current = zoom256();
    const target = clusterFlightTarget(
      cluster.members,
      {
        width: container.clientWidth || 1024,
        height: container.clientHeight || 768,
      },
      current,
    );
    if (!target) return;
    map.easeTo({
      center: [target.longitude, target.latitude],
      zoom: target.zoom256 - 1,
      duration: flightDuration(Math.abs(target.zoom256 - current)),
      easing: easeInOutCubic,
    });
  };

  const create = (cluster: ClusterPoint) => {
    const content = cluster.members.length === 1
      ? buildSingleElement(cluster.members[0])
      : buildClusterElement(cluster.members.length, cluster.members[0].thumb_file.url);

    if (cluster.members.length === 1) {
      content.addEventListener("click", () => onPhotoTap(cluster.members[0]));
    } else {
      content.addEventListener("click", () => flyToCluster(cluster));
    }

    const wrapper = document.createElement("div");
    wrapper.className = "photo-cluster-marker-wrapper";
    wrapper.appendChild(content);
    return new mapboxgl.Marker({ element: wrapper })
      .setLngLat([cluster.longitude, cluster.latitude]);
  };

  return createClusterController<mapboxgl.Marker>({
    zoom256,
    view: () => {
      const bounds = map.getBounds();
      if (!bounds) return null;
      const west = bounds.getWest();
      const east = bounds.getEast();
      const north = bounds.getNorth();
      const south = bounds.getSouth();
      return {
        centerLng: (west + east) / 2,
        centerLat: (north + south) / 2,
        halfLng: (east - west) / 2,
        halfLat: (north - south) / 2,
      };
    },
    create,
    add: (markers) => markers.forEach((marker) => marker.addTo(map)),
    remove: (marker) => marker.remove(),
    element: (marker) => marker.getElement().firstElementChild as HTMLElement | null,
  });
}

export default function MapPage({ isActive, overlayActive }: MapPageProps) {
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const tokenContext = useContext(MapTokenContext);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const [searchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const view: MapView = searchParams.get("view") === "photos" ? "photos" : "regions";

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo>();
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [tokenState, setTokenState] = useState<LoadState>(
    tokenContext?.token?.token ? "ready" : "loading",
  );
  const [mapState, setMapState] = useState<"ready" | "error">("ready");
  const [requestVersion, setRequestVersion] = useState(0);

  const clusterItems = useMemo<PhotoClusterItem[]>(() => photos.flatMap((photo) => {
    if (!photo.metadata.location) return [];
    return [{
      id: photo.id,
      coordinate: photo.metadata.location,
      thumb_file: photo.thumb_file,
      clustering_identifier: `photo:${photo.id}`,
    }];
  }), [photos]);

  const photosById = useMemo(
    () => new Map(photos.map((photo) => [photo.id, photo])),
    [photos],
  );

  const openPrefecture = useCallback((prefectureId: number, prefectureName: string) => {
    navigateRef.current(`/map/prefecture/${prefectureId}`, {
      state: { prefectureName },
    });
  }, []);

  useEffect(() => {
    if (tokenContext?.token?.token) {
      setTokenState("ready");
      return;
    }
    const controller = new AbortController();
    setTokenState("loading");
    fetchMapboxToken(controller.signal)
      .then((mapboxToken) => {
        tokenContext?.setToken({ type: MapType.MapBox, token: mapboxToken });
        setTokenState("ready");
      })
      .catch((error) => {
        if (!isCanceledMapRequest(error)) setTokenState("error");
      });
    return () => controller.abort();
  }, [requestVersion, tokenContext]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    fetchMapPhotos(controller.signal)
      .then((result) => {
        setPhotos(result);
        setLoadState("ready");
      })
      .catch((error) => {
        if (!isCanceledPhotoRequest(error)) setLoadState("error");
      });
    return () => controller.abort();
  }, [requestVersion]);

  const openPhoto = useCallback((item: PhotoClusterItem) => {
    const photo = photosById.get(item.id);
    if (!photo) return;
    setSelectedPhoto(photo);
    setIsPhotoOpen(true);
    window.history.pushState(window.history.state, "", `/photo/${photo.id}`);
  }, [photosById]);

  const handlePhotoOpenChange = useCallback((isOpen: boolean, path?: string) => {
    setIsPhotoOpen(isOpen);
    if (isOpen) return;
    if (path) navigate(path);
    else if (/^\/photo\/\d+$/.test(window.location.pathname)) window.history.back();
  }, [navigate]);

  useEffect(() => {
    const handlePopState = () => {
      if (!/^\/photo\/\d+$/.test(window.location.pathname)) setIsPhotoOpen(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!isActive) setIsPhotoOpen(false);
  }, [isActive]);

  useEffect(() => {
    const token = tokenContext?.token?.token;
    if (view !== "photos" || !token || !mapContainer || loadState !== "ready") return;

    let activeMap: mapboxgl.Map | null = null;
    let clusterController: ClusterController | null = null;
    let styleTimeout: number | undefined;
    const animationFrame = window.requestAnimationFrame(() => {
      mapContainer.replaceChildren();
      mapboxgl.accessToken = token;
      setMapState("ready");

      activeMap = new mapboxgl.Map({
        container: mapContainer,
        style: "mapbox://styles/mapbox/streets-v12",
        center: JAPAN_INITIAL_CENTER,
        zoom: JAPAN_INITIAL_ZOOM,
        attributionControl: false,
      });
      mapRef.current = activeMap;
      activeMap.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
      activeMap.addControl(new mapboxgl.AttributionControl({ compact: true }));

      styleTimeout = window.setTimeout(() => {
        if (activeMap && !activeMap.isStyleLoaded()) setMapState("error");
      }, 15_000);

      activeMap.once("style.load", () => {
        if (!activeMap) return;
        if (styleTimeout !== undefined) window.clearTimeout(styleTimeout);
        applyChineseMapLabels(activeMap);
        setMapState("ready");
      });

      activeMap.once("load", () => {
        if (!activeMap) return;
        clusterController = createMapboxClusterController(activeMap, openPhoto);
        clusterController.setItems(clusterItems);
        activeMap.on("movestart", clusterController.regionChangeStart);
        activeMap.on("moveend", clusterController.regionChangeEnd);
        activeMap.resize();
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (styleTimeout !== undefined) window.clearTimeout(styleTimeout);
      clusterController?.dispose();
      activeMap?.remove();
      if (mapRef.current === activeMap) mapRef.current = null;
    };
  }, [clusterItems, loadState, mapContainer, openPhoto, tokenContext?.token?.token, view]);

  useEffect(() => {
    if (!isActive) return;
    const frame = window.requestAnimationFrame(() => mapRef.current?.resize());
    return () => window.cancelAnimationFrame(frame);
  }, [isActive]);

  const isWaiting = loadState === "loading" || tokenState === "loading";
  const hasError = loadState === "error" || tokenState === "error" || mapState === "error";

  return (
    <section
      aria-hidden={!isActive}
      data-map-view={view}
      className={`fixed inset-0 z-0 transition-[opacity,background-color] duration-200 ${
        view === "regions" ? "bg-white" : "bg-default-100"
      } ${
        isActive ? "visible opacity-100" : "invisible pointer-events-none opacity-0"
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: reduceMotion ? 0 : 0.2, ease: "easeOut" },
          }}
          exit={{
            opacity: 0,
            pointerEvents: "none",
            transition: { duration: reduceMotion ? 0 : 0.15, ease: "easeIn" },
          }}
        >
          {view === "photos" ? (
            <div ref={setMapContainer} className="h-full w-full" />
          ) : (
            <RegionsMap
              photos={photos}
              overlayActive={overlayActive}
              onRegionSelect={openPrefecture}
              onBack={() => navigateRef.current("/map")}
            />
          )}
        </motion.div>
      </AnimatePresence>
      <MapViewSwitcher view={view} isHidden={overlayActive} />

      {isWaiting ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-sm">
          <Spinner
            color="default"
            label="loading"
            classNames={{ label: "text-default-500" }}
          />
        </div>
      ) : null}

      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/65 px-6 backdrop-blur-md">
          <div className="rounded-large bg-white/85 p-6 text-center shadow-medium">
            <p className="mb-4 text-sm text-default-500">照片地图暂时无法加载。</p>
            <Button
              variant="flat"
              startContent={<TbRefresh size={18} />}
              onPress={() => setRequestVersion((version) => version + 1)}
            >
              重试
            </Button>
          </div>
        </div>
      ) : null}

      {selectedPhoto ? (
        <PhotoModal
          photo={selectedPhoto}
          isOpen={isPhotoOpen}
          onOpenChange={handlePhotoOpenChange}
        />
      ) : null}
    </section>
  );
}
