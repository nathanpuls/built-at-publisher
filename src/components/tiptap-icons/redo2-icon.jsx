import { memo } from "react"
import { ArrowClockwise } from "@phosphor-icons/react"

export const Redo2Icon = memo(({ className, ...props }) => (
  <ArrowClockwise className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

Redo2Icon.displayName = "Redo2Icon"
