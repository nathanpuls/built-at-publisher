import { memo } from "react"
import { ListBullets } from "@phosphor-icons/react"

export const ListIcon = memo(({ className, ...props }) => (
  <ListBullets className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

ListIcon.displayName = "ListIcon"
