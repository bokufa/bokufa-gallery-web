import { Card, CardFooter, Image } from "@heroui/react";
import moment from "moment";
import { Photo } from "../models/gallery";

export default function PhotoImageCard({ photo, isDesktop }: { photo: Photo, isDesktop: boolean}) {
  const image = photo.large_file ?? photo.medium_file ?? photo.thumb_file;

  return (
    <Card isFooterBlurred radius="lg" className="border-none">
      <Image
        isBlurred
        draggable={false}
        classNames={{ img: 'pointer-events-none', blurredImg: 'pointer-events-none' }}
        className="object-contain"
        src={image.url}
        width={image.width}
        height={image.height}
        style={{ maxHeight: isDesktop ? 'calc(100dvh - 20rem)' : 'calc(100dvh - 18rem)', height: 'auto' }}
      />
      <CardFooter className="justify-between before:bg-white/10 border-white/20 border-1 overflow-hidden py-1 absolute before:rounded-xl rounded-large bottom-1 shadow-small right-1 z-10 w-auto font-normal">
        <div className='text-tiny md:text-small text-white/80'>
          &copy; {moment(photo.metadata.datetime).year()} {photo.author?.name}
        </div>
      </CardFooter>
    </Card>
  );
}
