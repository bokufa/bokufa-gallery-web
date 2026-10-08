import { Card, CardHeader, CardBody, CardFooter, Divider, Skeleton } from "@heroui/react";
import { Photo } from "../models/gallery";
import CameraIdentity from "./CameraIdentity";
import { cameraIdentity } from "../utils/cameraIdentity";
import FilmInfo from "./FilmInfo";

export default function PhotoMetaCard({ photo, loading }: { photo: Photo, loading: boolean }) {
  const { film } = cameraIdentity(photo.metadata);
  const lens = photo.metadata.lens;
  const lensLabel = lens ? [lens.manufacture?.name, lens.model].filter(Boolean).join(" ") : "";
  const secondaryDetails = [lensLabel, film.scanner].filter(Boolean);
  const exposureDetails = [
    Number.isFinite(photo.metadata.photographic_sensitivity) ? `ISO ${photo.metadata.photographic_sensitivity}` : "",
    Number.isFinite(photo.metadata.f_number) ? `ƒ${photo.metadata.f_number}` : "",
    photo.metadata.exposure_time_rat ? `${photo.metadata.exposure_time_rat} s` : "",
    Number.isFinite(photo.metadata.focal_length) ? `${photo.metadata.focal_length} mm` : "",
  ].filter(Boolean);
  return (
    <Card className='overflow-visible'>
      <CardHeader data-photo-meta="camera" className='text-small font-semibold bg-default-100 py-2'>
        {loading ? (
          <Skeleton className="w-2/5 rounded-lg">
            <div className="h-5 w-2/5 rounded-lg bg-default-200"></div>
          </Skeleton>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <CameraIdentity metadata={photo.metadata} />
            <FilmInfo stock={film.stock} />
          </div>
        )}
      </CardHeader>
      {loading || secondaryDetails.length ? (
        <>
          <CardBody data-photo-meta="lens" className='text-small text-default-500 py-2 overflow-y-visible'>
            {loading ? (
              <Skeleton className="w-4/5 rounded-lg">
                <div className="h-5 w-4/5 rounded-lg bg-default-200"></div>
              </Skeleton>
            ) : (
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {secondaryDetails.map((detail, index) => (
                  <span key={detail} className="inline-flex items-baseline gap-2">
                    {index ? <span aria-hidden="true" className="text-default-300 font-extralight">｜</span> : null}
                    <span>{detail}</span>
                  </span>
                ))}
              </p>
            )}
          </CardBody>
          <Divider className='bg-default-100'/>
        </>
      ) : null}
      <CardFooter data-photo-meta="exposure" className='py-2 flex justify-around text-default-500'>
        {exposureDetails.map((detail, index) => (
          <span key={detail} className="contents">
            {index ? <code className='text-small text-default-300 font-extralight'>|</code> : null}
            <code className='text-small'>{detail}</code>
          </span>
        ))}
      </CardFooter>
    </Card>
  );
}
