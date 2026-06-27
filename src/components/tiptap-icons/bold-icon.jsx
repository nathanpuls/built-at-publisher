import { memo } from "react"
import { TextB } from "@phosphor-icons/react"

export const BoldIcon = memo(({ className, ...props }) => (
  <TextB className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

BoldIcon.displayName = "BoldIcon"
