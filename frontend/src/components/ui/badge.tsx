import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primaryMain text-white hover:bg-primaryMain/80",
        secondary:
          "border-transparent bg-secondaryMain text-textMain hover:bg-secondaryMain/80",
        destructive:
          "border-transparent bg-red-500 text-white hover:bg-red-500/80",
        outline: "text-textMain border-borderMain",
        active: "border-transparent bg-status-active-bg text-status-active-text",
        suspend: "border-transparent bg-status-suspend-bg text-status-suspend-text",
        pending: "border-transparent bg-status-pending-bg text-status-pending-text",
        leave: "border-transparent bg-status-leave-bg text-status-leave-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
