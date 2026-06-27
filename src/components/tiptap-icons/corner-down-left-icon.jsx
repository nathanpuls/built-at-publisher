import { memo } from "react"
import { ArrowBendDownLeft } from "@phosphor-icons/react"

export const CornerDownLeftIcon = memo(({ className, ...props }) => (
  <ArrowBendDownLeft className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

CornerDownLeftIcon.displayName = "CornerDownLeftIcon"
