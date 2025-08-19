import { Photo } from "../models/gallery.ts";
import {
  Image,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody, Link, Spacer, Card, CardFooter, CardHeader, CardBody, Divider, Skeleton
} from "@heroui/react";
import { IoCalendarOutline, IoLocationOutline } from "react-icons/io5";
import moment from "moment";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import useMediaQuery from "../hooks/useMediaQuery.tsx"

export interface PhotoModalProps {
  photo: Photo
  isOpen: boolean,
  onOpenChange: (isOpen: boolean, path?: string) => void;
}

export default function PhotoModal(props: PhotoModalProps) {
  const isDesktop = useMediaQuery('(min-width: 960px)');
  const [photo, setPhoto] = useState(props.photo)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (props.isOpen) {
        setLoading(true)
        setTimeout(() => {
          axios.get< {payload: Photo} >(`https://api.bokufa.art/api/photos/${props.photo.id}`)
            .then(res => {
              setPhoto(res.data.payload)
              setLoading(false)
            })
        }, 300)
    }
  }, [props.isOpen, props.photo.id])


  const isPortrait = photo.thumb_file.width <= photo.thumb_file.height;
  const cityLinks = useMemo(() => (
    <div className='flex gap-1 font-bold text-foreground'>
      {photo.metadata.city?.prefecture.country.name} {' '}
      {photo.metadata.city?.prefecture.name} {' '}
      {photo.metadata.city?.name}
    </div>
  ), [
    photo.metadata.city?.id,
    photo.metadata.city?.name,
    photo.metadata.city?.prefecture.country.name,
    photo.metadata.city?.prefecture.id,
    photo.metadata.city?.prefecture.name,
    props
  ])

  const modal = useMemo(() => {
    return <ModalContent className='overflow-hidden'>
      {() => (
         (!isDesktop) || (!isPortrait) ?
          <>
            <ModalHeader className="p-0 flex flex-col gap-1">
              <Card
                isFooterBlurred
                radius="lg"
                className="border-none"
              >
                <Image
                  isBlurred
                  draggable={false}
                  classNames={{
                    img: 'pointer-events-none',
                    blurredImg: 'pointer-events-none'
                  }}
                  className="object-contain"
                  src={photo.medium_file?.url}
                  width={photo.medium_file?.width}
                  height={photo.medium_file?.height}
                  style={{ maxHeight: isDesktop ? 'calc(100dvh - 20rem)' : 'calc(100dvh - 18rem)', height: 'auto' }}
                />
                <CardFooter
                  className="justify-between before:bg-white/10 border-white/20 border-1 overflow-hidden py-1 absolute before:rounded-xl rounded-large bottom-1 shadow-small right-1 z-10 w-auto font-normal">
                  <div
                    className='text-tiny md:text-small text-white/80'>&copy; {moment(photo.metadata.datetime).year()} {photo.author?.name}</div>
                </CardFooter>
              </Card>
            </ModalHeader>
            <ModalBody className="p-4">
              <div className='flex flex-wrap items-center justify-between'>
                {
                  photo.metadata.city ?
                    <div className='flex items-center text-default-500 gap-1'>
                      <IoLocationOutline className='flex-shrink-0' size={20}/>
                      <div className='flex flex-wrap gap-x-3'>
                        {cityLinks}
                        {
                          photo.metadata.place ?
                            <div className='flex items-center'>
                              <Link color='foreground'>{photo.metadata.place.name}</Link>
                            </div>
                            :
                            null
                        }
                      </div>
                    </div>
                    :
                    null
                }

                <div className='flex items-center text-small text-default-500 gap-1.5'>
                  <IoCalendarOutline size={18}/>
                  <div>
                    {moment(photo.metadata.datetime).utcOffset(`+${photo.metadata.timezone.split('+')[1]}`).format('YYYY-MM-DD HH:mm ([GMT]Z)')}
                  </div>
                </div>              
              </div>
              
              <div className='flex items-center text-small text-default-500 gap-1.5'>
                {
                  photo.title ?
                    <div className="flex items-center">
                      「{photo.title}」
                    </div>
                  :
                  null
                }
              </div>  

              <div className='gap-4 grid grid-cols-1 md:grid-cols-2'>
                <Card className='overflow-visible'>
                  <CardHeader className='text-small font-semibold bg-default-100 py-2'>
                    {
                      loading ?
                        <Skeleton className="w-2/5 rounded-lg">
                          <div className="h-5 w-2/5 rounded-lg bg-default-200"></div>
                        </Skeleton>
                        :
                        <>
                          <code className='text-small'>{photo.metadata.camera?.manufacture.name}</code>
                          <code className='text-small text-default-300 font-extralight'>|</code>
                          <code className='text-small'>{photo.metadata.camera?.model}</code>
                          <code className='text-small text-default-300 font-extralight'>|</code>
                        </>
                    }
                  </CardHeader>
                  <CardBody className='text-small text-default-500 py-2 overflow-y-visible'>
                    {
                      loading ?
                        <Skeleton className="w-4/5 rounded-lg">
                          <div className="h-5 w-4/5 rounded-lg bg-default-200"></div>
                        </Skeleton>
                        :
                        (photo.metadata.lens ?
                            `${photo.metadata.lens?.manufacture.name} ${photo.metadata.lens?.model}`
                            :
                            'unknown_lens'
                        )
                    }
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

              </div>
            </ModalBody>
          </>
          :
          <>
            <ModalHeader className="p-0 flex flex-col gap-1"/>
            <ModalBody className="p-0 overflow-hidden">
              <div className='flex overflow-hidden'>
                <div className='w-[54%]'>
                  <Card
                    isFooterBlurred
                    radius="lg"
                    className="border-none h-[100%]"
                  >
                    <Image
                      isBlurred
                      classNames={{
                        wrapper: 'h-[100%]',
                        zoomedWrapper: 'h-[100%]',
                        blurredImg: 'h-[100%] pointer-events-none',
                        img: 'pointer-events-none',
                      }}
                      className="object-contain h-[100%]"
                      src={photo.medium_file?.url}
                      width={photo.medium_file?.width}
                      height={photo.medium_file?.height}
                      style={{ height: 'auto' }}
                    />
                    <CardFooter
                      className="justify-between before:bg-white/10 border-white/20 border-1 overflow-hidden py-1 absolute before:rounded-xl rounded-large bottom-1 shadow-small right-1 z-10 w-auto font-normal">
                      <div
                        className='text-tiny md:text-small text-white/80'>&copy; {moment(photo.metadata.datetime).year()} {photo.author?.name}</div>
                    </CardFooter>
                  </Card>
                </div>

                <div className='w-[46%] p-6 flex flex-col gap-1 justify-end'>
                  {
                    photo.metadata.city ?
                      <div className='flex items-center text-default-500 gap-1'>
                        <IoLocationOutline size={20}/>
                        <div className='flex gap-x-3 flex-wrap'>
                          {cityLinks}
                          {
                            photo.metadata.place ?
                              <div className='flex items-center'>
                                <Link color='foreground'>{photo.metadata.place.name}</Link>
                              </div>
                              :
                              null
                          }
                        </div>
                      </div>
                      :
                      null
                  }

                  <div className='flex items-center text-small text-default-500 gap-1.5'>
                    {
                      photo.title ?
                        <div className="flex items-center">
                          「{photo.title}」
                        </div>
                      :
                      null
                    }
                  </div>

                  <div className='flex items-center text-default-500 gap-1 text-small'>
                    <IoCalendarOutline size={20}/>
                    {moment(photo.metadata.datetime).utcOffset(`+${photo.metadata.timezone.split('+')[1]}`).format('YYYY-MM-DD HH:mm ([GMT]Z)')}
                  </div>

                  <Spacer y={4}/>

                  <div className='gap-4 grid grid-cols-1'>
                    <Card className='overflow-visible'>
                      <CardHeader className='text-small font-semibold bg-default-100 py-2'>
                        {
                          loading ?
                            <Skeleton className="w-2/5 rounded-lg">
                              <div className="h-5 w-2/5 rounded-lg bg-default-200"></div>
                            </Skeleton>
                            :
                            <>
                              <code className='text-small'>{photo.metadata.camera?.manufacture.name}</code>
                              <code className='text-small text-default-300 font-extralight'>|</code>
                              <code className='text-small'>{photo.metadata.camera?.model}</code>
                              <code className='text-small text-default-300 font-extralight'>|</code>
                            </>
                        }
                      </CardHeader>
                      <CardBody className='text-small text-default-500 py-2 overflow-y-visible'>
                        {
                          loading ?
                            <Skeleton className="w-4/5 rounded-lg">
                              <div className="h-5 w-4/5 rounded-lg bg-default-200"></div>
                            </Skeleton>
                            :
                            `${photo.metadata.lens?.manufacture.name} ${photo.metadata.lens?.model}`
                        }
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

                  </div>
                </div>
              </div>
            </ModalBody>
          </>
      )}
    </ModalContent>
  }, [cityLinks, isDesktop, isPortrait, loading, photo.author?.name, photo.medium_file?.height, photo.medium_file?.url, photo.medium_file?.width, photo.metadata.camera, photo.metadata.city, photo.metadata.datetime, photo.metadata.exposure_time_rat, photo.metadata.f_number, photo.metadata.focal_length, photo.metadata.has_location, photo.metadata.lens, photo.metadata.location, photo.metadata.photographic_sensitivity, photo.metadata.place, photo.metadata.timezone])

  return <Modal
    isOpen={props.isOpen}
    onOpenChange={props.onOpenChange}
    backdrop='blur'
    size='4xl'
    scrollBehavior='inside'
    classNames={{
      closeButton: 'z-20'
    }}
  >
    {modal}
  </Modal>;
}

