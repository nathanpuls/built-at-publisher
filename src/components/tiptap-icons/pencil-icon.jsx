import { memo } from "react"

export const PencilIcon = memo(({
  className,
  ...props
}) => {
  return (
    <svg
      width="24"
      height="24"
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}>
      <path
        d="M16.862 3.487a2.1 2.1 0 0 1 2.97 0l.681.681a2.1 2.1 0 0 1 0 2.97L9.47 18.181a1 1 0 0 1-.45.263l-4.21 1.203a1 1 0 0 1-1.236-1.236l1.203-4.21a1 1 0 0 1 .263-.45L16.862 3.487Zm1.556 1.414a.1.1 0 0 0-.142 0L6.632 16.545l-.584 2.045 2.045-.584L19.737 6.362a.1.1 0 0 0 0-.142l-.681-.681Z"
        fill="currentColor" />
    </svg>
  )
})

PencilIcon.displayName = "PencilIcon"
