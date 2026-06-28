import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "tap inline-flex items-center justify-center gap-2 rounded-blob font-display font-semibold transition-transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none",
  {
    variants: {
      variant: {
        primary: "bg-violet text-white shadow-glow hover:brightness-110",
        mint: "bg-mint text-ink shadow-glow-mint hover:brightness-105",
        coral: "bg-coral text-ink shadow-glow-coral hover:brightness-105",
        sun: "bg-sun text-ink hover:brightness-105",
        ghost: "bg-white/10 text-current hover:bg-white/20",
        outline: "border-2 border-violet/40 text-current hover:bg-violet/10",
      },
      size: {
        md: "px-6 py-3 text-lg",
        lg: "px-8 py-4 text-2xl",
        xl: "px-10 py-6 text-3xl",
        icon: "h-14 w-14 p-0 text-2xl",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
