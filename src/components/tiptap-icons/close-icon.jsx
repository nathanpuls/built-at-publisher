import { memo } from "react"
import { X } from "@phosphor-icons/react"

export const CloseIcon = memo(({ className, ...props }) => (
  <X className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

CloseIcon.displayName = "CloseIcon"
