import { memo } from "react"
import { LinkSimple } from "@phosphor-icons/react"

export const LinkIcon = memo(({ className, ...props }) => (
  <LinkSimple className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

LinkIcon.displayName = "LinkIcon"
