import { memo } from "react"
import { TextAlignRight } from "@phosphor-icons/react"

export const AlignRightIcon = memo(({ className, ...props }) => (
  <TextAlignRight className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

AlignRightIcon.displayName = "AlignRightIcon"
