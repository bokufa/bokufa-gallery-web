import { Card, CardHeader, CardBody, CardFooter, Divider, Skeleton, Button } from "@heroui/react";
import { Link } from "@heroui/link";
import { Photo } from "../models/gallery";
import { useRef, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { MdOutlineOpenInNew } from "react-icons/md";
import { useContext } from "react";
import { MapTokenContext } from "../contexts/MapToken";
import clsx from "clsx";
import 'mapbox-gl/dist/mapbox-gl.css';


export default function PhotoMapCard({ photo, loading, className }: { photo: Photo, loading: boolean, className: string}) {
  const mapRef = useRef()
  const mapContainerRef = useRef()
  const token = useContext(MapTokenContext)
  
  useEffect(() => {
    if (!token?.token) return;
    mapboxgl.accessToken = token!.token.token;
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: [photo.metadata.location.longitude, photo.metadata.location.latitude],
      zoom: 12,
      attributionControl: false,
      language: 'ja'
    });
    new mapboxgl.Marker({ color: "#ff0000" }) // 红色
      .setLngLat([photo.metadata.location.longitude, photo.metadata.location.latitude])
      .addTo(mapRef.current);

    return () => {
      mapRef.current.remove()
    }
  }, [])

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

