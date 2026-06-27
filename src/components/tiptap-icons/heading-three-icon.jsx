import { memo } from "react"
import { TextHThree } from "@phosphor-icons/react"

export const HeadingThreeIcon = memo(({ className, ...props }) => (
  <TextHThree className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

HeadingThreeIcon.displayName = "HeadingThreeIcon"
