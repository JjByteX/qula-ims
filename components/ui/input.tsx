import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-[var(--radius-sm)] border border-[var(--input)] bg-[var(--card)] px-3 py-2 text-[var(--text-base)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:border-[var(--ring)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "aria-invalid:border-[var(--destructive)] aria-invalid:focus-visible:ring-[var(--destructive)]",
        className
      )}
      {...props}
    />
  );
}

export { Input };
