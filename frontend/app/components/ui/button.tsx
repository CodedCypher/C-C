import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

/**
 * circuit.rocks — Button (shadcn primitive, brutalist restyle)
 * Hard 2px border, hard offset shadow, zero radius. The physical "press"
 * (translate + shadow shrink/collapse) is pure CSS via `.cr-press` + shadow utilities.
 */
const buttonVariants = cva(
  "cr-press inline-flex items-center justify-center gap-2.5 whitespace-nowrap border-2 border-line font-sans font-bold uppercase leading-none tracking-[0.04em] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "bg-signal text-ink shadow-brutal hover:shadow-press active:shadow-none",
        secondary:
          "bg-paper text-ink shadow-brutal hover:shadow-press active:shadow-none",
        ghost: "bg-transparent text-ink shadow-none border-line",
      },
      size: {
        sm: "px-3.5 py-2 text-xs",
        md: "px-5 py-3 text-[0.8125rem]",
        lg: "px-7 py-4 text-[0.9375rem]",
      },
      onDark: { true: "", false: "" },
    },
    compoundVariants: [
      {
        variant: "secondary",
        onDark: true,
        class:
          "bg-transparent text-paper border-paper shadow-[4px_4px_0_var(--paper)] hover:shadow-[2px_2px_0_var(--paper)] active:shadow-none",
      },
      { variant: "ghost", onDark: true, class: "text-paper border-paper" },
    ],
    defaultVariants: { variant: "primary", size: "md", onDark: false },
  },
);

function Button({
  className,
  variant,
  size,
  onDark,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, onDark, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
