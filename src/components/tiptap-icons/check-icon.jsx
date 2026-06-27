import { memo } from "react"
import { Check } from "@phosphor-icons/react"

export const CheckIcon = memo(({ className, ...props }) => (
  <Check className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

CheckIcon.displayName = "CheckIcon"
