import { Card, CardFooter, Button } from "@heroui/react";
import { Photo } from "../models/gallery";
import { useRef, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { MdOutlineOpenInNew } from "react-icons/md";
import { useContext } from "react";
import { MapTokenContext } from "../contexts/MapToken";
import clsx from "clsx";
import 'mapbox-gl/dist/mapbox-gl.css';
import { applyChineseMapLabels } from "../utils/mapbox";


export default function PhotoMapCard({ photo, className }: { photo: Photo, className: string}) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const token = useContext(MapTokenContext)
  const mapboxToken = token?.token?.token;
  const location = photo.metadata.location;
  
  useEffect(() => {
    if (!mapboxToken || !location || !mapContainerRef.current) return;
    let activeMap: mapboxgl.Map | null = null;
    const animationFrame = window.requestAnimationFrame(() => {
      const container = mapContainerRef.current;
      if (!container) return;
      container.replaceChildren();
      mapboxgl.accessToken = mapboxToken;
      activeMap = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [location.longitude, location.latitude],
        zoom: 12,
        attributionControl: false,
        language: 'ja'
      });
      mapRef.current = activeMap;
      new mapboxgl.Marker({ color: "#ff0000" })
        .setLngLat([location.longitude, location.latitude])
        .addTo(activeMap);
      activeMap.once("style.load", () => {
        if (!activeMap) return;
        applyChineseMapLabels(activeMap);
        activeMap.resize();
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      activeMap?.remove();
      if (mapRef.current === activeMap) mapRef.current = null;
    }
  }, [location, mapboxToken])

  return (
    <Card className={clsx(className)} isFooterBlurred>
      <div id='map-container' ref={mapContainerRef} className="w-full h-full"/>
      <CardFooter
        className="justify-between before:bg-white/10 border-white/20 border-1 overflow-hidden p-0 absolute before:rounded-xl rounded-large bottom-1 shadow-small right-1 z-10 w-auto font-normal">
        <Button
          className="text-tiny text-white bg-black/20"
          variant="flat"
          color="default"
          radius="lg"
          size="sm"
          isIconOnly
          onPress={() => {
            window.open(`https://maps.google.com/?q=${photo.metadata.location?.latitude},${photo.metadata.location?.longitude}`)
          }}
        >
          <MdOutlineOpenInNew size={16}/>
        </Button>
      </CardFooter>
    </Card>
  );
}
