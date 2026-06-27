import { memo } from "react"
import { TextStrikethrough } from "@phosphor-icons/react"

export const StrikeIcon = memo(({ className, ...props }) => (
  <TextStrikethrough className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

StrikeIcon.displayName = "StrikeIcon"
