import { memo } from "react"
import { TextItalic } from "@phosphor-icons/react"

export const ItalicIcon = memo(({ className, ...props }) => (
  <TextItalic className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

ItalicIcon.displayName = "ItalicIcon"
