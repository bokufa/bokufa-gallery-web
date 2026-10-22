import { IoLocationOutline } from "react-icons/io5";
import { Link } from "@heroui/react";
import { Photo } from "../models/gallery";
import { ReactNode } from "react";
import { countryCodeFor, nativePlaceName } from "../utils/placeNames";

export default function PhotoLocationInfo({ photo, cityLinks }: { photo: Photo, cityLinks: ReactNode }) {
  if (!photo.metadata.city) return null;
  return (
    <div className='flex items-center text-default-500 gap-1'>
      <IoLocationOutline className='flex-shrink-0' size={20}/>
      <div className='flex flex-wrap gap-x-3'>
        {cityLinks}
        {photo.metadata.place ? (
          <div className='flex items-center'>
            <Link color='foreground'>{nativePlaceName(photo.metadata.place, countryCodeFor(photo.metadata.city.prefecture.country), "place")}</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
