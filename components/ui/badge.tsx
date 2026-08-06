import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2.5 py-0.5 text-[var(--text-sm)] font-semibold w-fit whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
        accent: "bg-[var(--accent)] text-[var(--accent-foreground)]",
        outline: "border border-[var(--border)] text-[var(--foreground)]",
        destructive: "bg-[var(--destructive)] text-[var(--destructive-foreground)]",
        success: "bg-[var(--success)] text-[var(--success-foreground)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
