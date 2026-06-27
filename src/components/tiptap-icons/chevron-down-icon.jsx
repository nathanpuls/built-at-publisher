import { memo } from "react"
import { CaretDown } from "@phosphor-icons/react"

export const ChevronDownIcon = memo(({ className, ...props }) => (
  <CaretDown className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

ChevronDownIcon.displayName = "ChevronDownIcon"
