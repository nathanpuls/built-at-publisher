import { memo } from "react"
import { ArrowLeft } from "@phosphor-icons/react"

export const ArrowLeftIcon = memo(({ className, ...props }) => (
  <ArrowLeft className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

ArrowLeftIcon.displayName = "ArrowLeftIcon"
