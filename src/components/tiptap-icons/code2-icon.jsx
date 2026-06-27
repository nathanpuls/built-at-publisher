import { memo } from "react"
import { Code } from "@phosphor-icons/react"

export const Code2Icon = memo(({ className, ...props }) => (
  <Code className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

Code2Icon.displayName = "Code2Icon"
