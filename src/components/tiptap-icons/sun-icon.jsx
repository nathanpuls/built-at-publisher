import { memo } from "react"
import { Sun } from "@phosphor-icons/react"

export const SunIcon = memo(({ className, ...props }) => (
  <Sun className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

SunIcon.displayName = "SunIcon"
