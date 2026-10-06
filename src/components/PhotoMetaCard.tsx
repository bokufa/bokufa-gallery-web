import { Card, CardHeader, CardBody, CardFooter, Divider, Skeleton } from "@heroui/react";
import { Photo } from "../models/gallery";
import CameraIdentity from "./CameraIdentity";
import { cameraIdentity } from "../utils/cameraIdentity";
import FilmInfo from "./FilmInfo";

export default function PhotoMetaCard({ photo, loading }: { photo: Photo, loading: boolean }) {
  const { film } = cameraIdentity(photo.metadata);
  return (
    <Card className='overflow-visible'>
      <CardHeader className='text-small font-semibold bg-default-100 py-2'>
        {loading ? (
          <Skeleton className="w-2/5 rounded-lg">
            <div className="h-5 w-2/5 rounded-lg bg-default-200"></div>
          </Skeleton>
        ) : (
          <CameraIdentity metadata={photo.metadata} />
        )}
      </CardHeader>
      <CardBody className='text-small text-default-500 py-2 overflow-y-visible'>
        {loading ? (
          <Skeleton className="w-4/5 rounded-lg">
            <div className="h-5 w-4/5 rounded-lg bg-default-200"></div>
          </Skeleton>
        ) : (
          <>
            <p>{photo.metadata.lens ? `${photo.metadata.lens?.manufacture.name} ${photo.metadata.lens?.model}` : 'unknown_lens'}</p>
            <FilmInfo film={film} />
          </>
        )}
      </CardBody>
      <Divider className='bg-default-100'/>
      <CardFooter className='py-2 flex justify-around text-default-500'>
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
