import { Card, CardHeader, CardBody, CardFooter, Divider, Skeleton } from "@heroui/react";
import { Photo } from "../models/gallery";
import CameraIdentity from "./CameraIdentity";
import { cameraIdentity } from "../utils/cameraIdentity";
import FilmInfo from "./FilmInfo";

export default function PhotoMetaCard({ photo, loading }: { photo: Photo, loading: boolean }) {
  const { film } = cameraIdentity(photo.metadata);
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
      <CardBody data-photo-meta="lens" className='text-small text-default-500 py-2 overflow-y-visible'>
        {loading ? (
          <Skeleton className="w-4/5 rounded-lg">
            <div className="h-5 w-4/5 rounded-lg bg-default-200"></div>
          </Skeleton>
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span>{photo.metadata.lens ? `${photo.metadata.lens?.manufacture.name} ${photo.metadata.lens?.model}` : 'unknown_lens'}</span>
            {film.scanner ? (
              <span className="inline-flex items-baseline gap-2">
                <span aria-hidden="true" className="text-default-300 font-extralight">｜</span>
                <span>{film.scanner}</span>
              </span>
            ) : null}
          </p>
        )}
      </CardBody>
      <Divider className='bg-default-100'/>
      <CardFooter data-photo-meta="exposure" className='py-2 flex justify-around text-default-500'>
        <code className='text-small'>ISO {photo.metadata.photographic_sensitivity}</code>
        <code className='text-small text-default-300 font-extralight'>|</code>
        <code className='text-small'>ƒ{photo.metadata.f_number}</code>
        <code className='text-small text-default-300 font-extralight'>|</code>
        <code className='text-small'>{photo.metadata.exposure_time_rat} s</code>
        <code className='text-small text-default-300 font-extralight'>|</code>
        <code className='text-small'>{photo.metadata.focal_length} mm</code>
      </CardFooter>
    </Card>
  );
}
