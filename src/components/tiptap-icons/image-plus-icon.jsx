import { memo } from "react"
import { ImageSquare } from "@phosphor-icons/react"

export const ImagePlusIcon = memo(({ className, ...props }) => (
  <ImageSquare className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

ImagePlusIcon.displayName = "ImagePlusIcon"
