import { memo } from "react"
import { TextHFive } from "@phosphor-icons/react"

export const HeadingFiveIcon = memo(({ className, ...props }) => (
  <TextHFive className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

HeadingFiveIcon.displayName = "HeadingFiveIcon"
