import { memo } from "react"
import { PencilSimple } from "@phosphor-icons/react"

export const PencilIcon = memo(({ className, ...props }) => (
  <PencilSimple className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

PencilIcon.displayName = "PencilIcon"
