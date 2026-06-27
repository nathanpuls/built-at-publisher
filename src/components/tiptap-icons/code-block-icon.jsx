import { memo } from "react"
import { CodeBlock } from "@phosphor-icons/react"

export const CodeBlockIcon = memo(({ className, ...props }) => (
  <CodeBlock className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

CodeBlockIcon.displayName = "CodeBlockIcon"
