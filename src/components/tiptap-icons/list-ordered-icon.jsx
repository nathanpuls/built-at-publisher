import { memo } from "react"
import { ListNumbers } from "@phosphor-icons/react"

export const ListOrderedIcon = memo(({ className, ...props }) => (
  <ListNumbers className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

ListOrderedIcon.displayName = "ListOrderedIcon"
