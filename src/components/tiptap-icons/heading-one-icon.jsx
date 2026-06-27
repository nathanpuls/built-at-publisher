import { memo } from "react"
import { TextHOne } from "@phosphor-icons/react"

export const HeadingOneIcon = memo(({ className, ...props }) => (
  <TextHOne className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

HeadingOneIcon.displayName = "HeadingOneIcon"
