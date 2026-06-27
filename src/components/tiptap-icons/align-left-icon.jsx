import { memo } from "react"
import { TextAlignLeft } from "@phosphor-icons/react"

export const AlignLeftIcon = memo(({ className, ...props }) => (
  <TextAlignLeft className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

AlignLeftIcon.displayName = "AlignLeftIcon"
