import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary-main text-white hover:bg-primary-main/80",
        secondary:
          "border-transparent bg-secondary-main text-text-main hover:bg-secondary-main/80",
        destructive:
          "border-transparent bg-red-500 text-white hover:bg-red-500/80",
        outline: "text-text-main border-border-main",
        active: "border-transparent bg-status-active-bg text-status-active-text",
        suspend: "border border-amber-300 bg-status-suspend-bg text-status-suspend-text",
        pending: "border border-slate-300 bg-status-pending-bg text-status-pending-text",
        leave: "border-transparent bg-status-leave-bg text-status-leave-text",
        info: "border-transparent bg-blue-100 text-blue-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  children?: React.ReactNode;
}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
