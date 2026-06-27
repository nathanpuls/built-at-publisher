import { memo } from "react"
import { Trash } from "@phosphor-icons/react"

export const TrashIcon = memo(({ className, ...props }) => (
  <Trash className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

TrashIcon.displayName = "TrashIcon"
