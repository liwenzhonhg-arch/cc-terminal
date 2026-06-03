import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm text-xs font-mono transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] active:brightness-90 select-none",
  {
    variants: {
      variant: {
        default: "bg-amber text-white hover:bg-amber/85 hover:shadow-[0_0_8px_rgb(var(--cc-amber)/0.3)]",
        destructive: "bg-vermilion text-white hover:bg-vermilion/85 hover:shadow-[0_0_8px_rgb(var(--cc-vermilion)/0.3)]",
        outline: "border border-border bg-transparent text-muted hover:text-ink hover:border-ink/20 hover:bg-border/20",
        secondary: "bg-surface-raised text-ink hover:bg-border/30",
        ghost: "text-muted hover:text-ink hover:bg-border/20",
        link: "text-amber underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 px-2 py-1 text-2xs",
        lg: "h-9 px-4 py-2",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
