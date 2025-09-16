import { Photo } from "../models/gallery.ts";
import { Modal, ModalContent, ModalHeader, ModalBody, Spacer } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import useMediaQuery from "../hooks/useMediaQuery.tsx";
import PhotoImageCard from "./PhotoImageCard";
import PhotoLocationInfo from "./PhotoLocationInfo";
import PhotoDateInfo from "./PhotoDateInfo";
import PhotoTitle from "./PhotoTitle";
import PhotoMetaCard from "./PhotoMetaCard";
import PhotoMapCard from "./PhotoMapCard";

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
		return (
			<ModalContent className='overflow-hidden'>
				{() => (
					(!isDesktop || !isPortrait) ? (
						<>
							<ModalHeader className="p-0 flex flex-col gap-1">
								<PhotoImageCard photo={photo} isDesktop={isDesktop} />
							</ModalHeader>
							<ModalBody className="p-4">
								<div className='flex flex-wrap items-center justify-between'>
									<PhotoLocationInfo photo={photo} cityLinks={cityLinks} />
									<PhotoDateInfo photo={photo} />
								</div>
								<PhotoTitle photo={photo} />
								<div className='gap-4 grid grid-cols-1 md:grid-cols-2'>
									<PhotoMetaCard photo={photo} loading={loading} />
                  {photo.metadata.location ? (
                      <PhotoMapCard photo={photo} className={"overflow-hidden min-h-[109px] md:min-h-0"} /> 
                      ): null
                  }
								</div>
							</ModalBody>
						</>
					) : (
						<>
							<ModalHeader className="p-0 flex flex-col gap-1" />
							<ModalBody className="p-0 overflow-hidden">
								<div className='flex overflow-hidden'>
									<div className='w-[54%]'>
										<PhotoImageCard photo={photo} isDesktop={isDesktop} />
									</div>
									<div className='w-[46%] p-6 flex flex-col gap-1 justify-end'>
                    {photo.metadata.location ? (
                        <PhotoMapCard photo={photo} className={'overflow-hidden flex-1'} /> 
                        ): null
                      }
                    <Spacer y={4}/>
										<PhotoLocationInfo photo={photo} cityLinks={cityLinks} />
										<PhotoTitle photo={photo} />
										<PhotoDateInfo photo={photo} />
										<Spacer y={4}/>
										<div className='gap-4 grid grid-cols-1'>
											<PhotoMetaCard photo={photo} loading={loading}/>
										</div>
									</div>
								</div>
							</ModalBody>
						</>
					)
				)}
			</ModalContent>
		);
	}, [cityLinks, isDesktop, isPortrait, loading, photo]);

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
