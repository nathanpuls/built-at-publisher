import { memo } from "react"
import { TextHFour } from "@phosphor-icons/react"

export const HeadingFourIcon = memo(({ className, ...props }) => (
  <TextHFour className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

HeadingFourIcon.displayName = "HeadingFourIcon"
