import { memo } from "react"
import { Prohibit } from "@phosphor-icons/react"

export const BanIcon = memo(({ className, ...props }) => (
  <Prohibit className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

BanIcon.displayName = "BanIcon"
