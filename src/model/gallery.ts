export interface Response<T> {
  code: number
  payload: T
  success: boolean
}

export interface Photo {
  id: number
  title: string
  description: string
  author?: Author
  metadata: Metadata
  thumb_file: File
  medium_file?: File
  large_file?: File
  hdr_file?: File
}