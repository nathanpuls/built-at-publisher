import { memo } from "react"
import { TextAlignJustify } from "@phosphor-icons/react"

export const AlignJustifyIcon = memo(({ className, ...props }) => (
  <TextAlignJustify className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

AlignJustifyIcon.displayName = "AlignJustifyIcon"
