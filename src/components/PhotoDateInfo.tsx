import { IoCalendarOutline } from "react-icons/io5";
import moment from "moment";
import { Photo } from "../models/gallery";

export default function PhotoDateInfo({ photo }: { photo: Photo }) {
  return (
    <div className='flex items-center text-small text-default-500 gap-1.5'>
      <IoCalendarOutline size={18}/>
      <div>
        {moment(photo.metadata.datetime).utcOffset(`+${photo.metadata.timezone.split('+')[1]}`).format('YYYY-MM-DD HH:mm ([GMT]Z)')}
      </div>
    </div>
  );
}
