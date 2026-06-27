import { memo } from "react"
import { TextSuperscript } from "@phosphor-icons/react"

export const SuperscriptIcon = memo(({ className, ...props }) => (
  <TextSuperscript className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

SuperscriptIcon.displayName = "SuperscriptIcon"
