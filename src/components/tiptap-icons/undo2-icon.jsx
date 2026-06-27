import { memo } from "react"
import { ArrowCounterClockwise } from "@phosphor-icons/react"

export const Undo2Icon = memo(({ className, ...props }) => (
  <ArrowCounterClockwise className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

Undo2Icon.displayName = "Undo2Icon"
