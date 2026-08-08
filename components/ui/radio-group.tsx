"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Small native <input type="radio">-based RadioGroup/RadioGroupItem pair
// (docs/phases-plan-revision-1.md Phase 12.3). No Radix radio-group
// package is installed and no built-in radio-group primitive exists in
// components/ui, so this is a plain native implementation rather than a
// new dependency — styled with the same CSS variables, focus ring, and
// checked-state fill as components/ui/checkbox.tsx so it reads as part
// of the same design system.
//
// RadioGroup just supplies the shared `name` (so items behave as one
// group) and the controlled value/onValueChange pair via context —
// RadioGroupItem renders the actual <input>.

type RadioGroupContextValue = {
  name: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
  disabled?: boolean;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

function RadioGroup({
  name,
  value,
  onValueChange,
  disabled,
  className,
  children,
  ...props
}: {
  name: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
  disabled?: boolean;
} & React.ComponentPropsWithoutRef<"div">) {
  return (
    <RadioGroupContext.Provider value={{ name, value, onValueChange, disabled }}>
      <div data-slot="radio-group" role="radiogroup" className={cn(className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

function RadioGroupItem({
  value,
  disabled,
  className,
  id,
  ...props
}: {
  value: string;
  disabled?: boolean;
} & Omit<React.ComponentPropsWithoutRef<"input">, "type" | "checked" | "onChange" | "value">) {
  const group = React.useContext(RadioGroupContext);
  if (!group) {
    throw new Error("RadioGroupItem must be used inside a RadioGroup");
  }

  const isChecked = group.value === value;
  const isDisabled = disabled ?? group.disabled;

  return (
    <input
      type="radio"
      id={id}
      name={group.name}
      value={value}
      checked={isChecked}
      disabled={isDisabled}
      onChange={() => group.onValueChange(value)}
      data-slot="radio-group-item"
      data-state={isChecked ? "checked" : "unchecked"}
      className={cn(
        "peer size-4 shrink-0 appearance-none rounded-full border border-[var(--input)] bg-[var(--card)] outline-none transition-colors",
        "checked:border-[var(--accent)] checked:bg-[var(--accent)]",
        "checked:bg-[radial-gradient(circle,var(--accent-foreground)_0_30%,transparent_35%)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

export { RadioGroup, RadioGroupItem };
