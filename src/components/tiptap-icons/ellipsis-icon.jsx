import { memo } from "react"
import { DotsThree } from "@phosphor-icons/react"

export const EllipsisIcon = memo(({ className, ...props }) => (
  <DotsThree className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

EllipsisIcon.displayName = "EllipsisIcon"
