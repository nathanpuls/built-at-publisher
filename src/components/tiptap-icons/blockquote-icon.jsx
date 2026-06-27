import { memo } from "react"
import { Quotes } from "@phosphor-icons/react"

export const BlockquoteIcon = memo(({ className, ...props }) => (
  <Quotes className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

BlockquoteIcon.displayName = "BlockquoteIcon"
