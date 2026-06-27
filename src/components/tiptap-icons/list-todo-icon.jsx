import { memo } from "react"
import { ListChecks } from "@phosphor-icons/react"

export const ListTodoIcon = memo(({ className, ...props }) => (
  <ListChecks className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

ListTodoIcon.displayName = "ListTodoIcon"
