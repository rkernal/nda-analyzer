import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Re-themed to the Sandbox light palette (Cornerstone navy/orange).
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--cornerstone-orange)] text-white hover:bg-[var(--cornerstone-orange-600)]",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-[var(--border)] bg-white text-[var(--cornerstone-navy)] hover:bg-stone-100",
        secondary: "bg-stone-100 text-[var(--cornerstone-navy)] hover:bg-stone-200",
        ghost: "text-[var(--foreground)] hover:bg-stone-100",
        link: "text-[var(--cornerstone-orange)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
