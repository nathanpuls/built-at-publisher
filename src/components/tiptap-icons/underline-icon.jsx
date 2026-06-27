import { memo } from "react"
import { TextUnderline } from "@phosphor-icons/react"

export const UnderlineIcon = memo(({ className, ...props }) => (
  <TextUnderline className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

UnderlineIcon.displayName = "UnderlineIcon"
