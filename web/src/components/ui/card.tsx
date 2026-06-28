import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-blob bg-white/90 dark:bg-nebula/80 backdrop-blur p-5 shadow-tile",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";
