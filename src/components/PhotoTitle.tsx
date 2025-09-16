import { Photo } from "../models/gallery";

export default function PhotoTitle({ photo }: { photo: Photo }) {
  if (!photo.title) return null;
  return (
    <div className='flex items-center text-small text-default-500 gap-1.5'>
      <div className="flex items-center">「{photo.title}」</div>
    </div>
  );
}
