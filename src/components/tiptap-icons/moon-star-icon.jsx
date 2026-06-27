import { memo } from "react"
import { MoonStars } from "@phosphor-icons/react"

export const MoonStarIcon = memo(({ className, ...props }) => (
  <MoonStars className={className} size={24} weight="bold" aria-hidden="true" focusable="false" {...props} />
))

MoonStarIcon.displayName = "MoonStarIcon"
