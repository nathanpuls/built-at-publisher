import { memo } from "react"
import { Highlighter } from "@phosphor-icons/react"

export const HighlighterIcon = memo(({ className, ...props }) => (
  <Highlighter className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

HighlighterIcon.displayName = "HighlighterIcon"
