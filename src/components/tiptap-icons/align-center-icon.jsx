import { memo } from "react"
import { TextAlignCenter } from "@phosphor-icons/react"

export const AlignCenterIcon = memo(({ className, ...props }) => (
  <TextAlignCenter className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

AlignCenterIcon.displayName = "AlignCenterIcon"
