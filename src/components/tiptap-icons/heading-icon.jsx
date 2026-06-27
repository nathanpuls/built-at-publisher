import { memo } from "react"
import { TextH } from "@phosphor-icons/react"

export const HeadingIcon = memo(({ className, ...props }) => (
  <TextH className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

HeadingIcon.displayName = "HeadingIcon"
