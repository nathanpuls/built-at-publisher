import { memo } from "react"
import { TextSubscript } from "@phosphor-icons/react"

export const SubscriptIcon = memo(({ className, ...props }) => (
  <TextSubscript className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

SubscriptIcon.displayName = "SubscriptIcon"
