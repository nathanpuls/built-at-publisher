import { memo } from "react"
import { TextHTwo } from "@phosphor-icons/react"

export const HeadingTwoIcon = memo(({ className, ...props }) => (
  <TextHTwo className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

HeadingTwoIcon.displayName = "HeadingTwoIcon"
