import { memo } from "react"
import { TextHSix } from "@phosphor-icons/react"

export const HeadingSixIcon = memo(({ className, ...props }) => (
  <TextHSix className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

HeadingSixIcon.displayName = "HeadingSixIcon"
