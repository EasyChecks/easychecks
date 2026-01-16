import * as React from "react"
import { cn } from "@/lib/utils"

// เพิ่ม named export สำหรับสร้างคลาสตาม variant/size
export const buttonVariants = ({ variant = "default", size } = {}) => {
  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
  const variants = {
    default: "bg-transparent text-inherit",
    ghost: "bg-transparent hover:bg-gray-100",
    primary: "bg-orange-600 text-white hover:bg-brand-primary",
  }
  const sizes = {
    icon: "h-8 w-8 p-0",
    default: "h-10 px-4 py-2",
  }
  return cn(base, variants[variant] ?? variants.default, sizes[size] ?? sizes.default)
}

export default function Button({ children, className = "", variant = "default", size, ...props }) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  )
}
