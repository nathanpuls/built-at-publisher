import { memo } from "react"
import { ArrowSquareOut } from "@phosphor-icons/react"

export const ExternalLinkIcon = memo(({ className, ...props }) => (
  <ArrowSquareOut className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

ExternalLinkIcon.displayName = "ExternalLinkIcon"
