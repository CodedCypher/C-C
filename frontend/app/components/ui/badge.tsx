import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

/**
 * circuit.rocks — Badge / Tag (shadcn primitive, brutalist restyle)
 * Square (zero-radius) mono uppercase pill. Stock / sold-out / clone / sale / signal / neutral.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-[5px] border-2 font-mono font-bold uppercase leading-none w-fit",
  {
    variants: {
      variant: {
        neutral: "bg-paper text-ink border-line",
        signal: "bg-signal text-ink border-line",
        sale: "bg-hazard text-paper border-line",
        stock: "bg-transparent text-stock border-stock",
        soldout: "bg-transparent text-soldout border-soldout",
        clone: "bg-transparent text-ink border-line",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[0.6875rem] tracking-[0.08em]",
        md: "px-2 py-1 text-[0.8125rem] tracking-[0.06em]",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
