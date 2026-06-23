/**
 * circuit.rocks — transfers feature: brutalist field primitives.
 *
 * Co-located input helpers so the long neo-brutalist class string lives in one
 * place (mirrors the products feature's `product-form/fields.tsx`). Each field
 * takes a dotted `path` (e.g. `lines.0.quantity`) and an `errors` map (from
 * `unwrapFieldErrors().fieldErrors` or `zod.flatten().fieldErrors`); when
 * present it renders the message in red mono under the control.
 */

import type * as React from "react";

import { cn } from "~/lib/utils";

export type FieldErrors = Record<string, string[]>;

/** The shared brutalist control class (input / select / textarea). */
export const controlClass =
  "w-full border-2 border-line bg-paper py-2.5 px-3 font-mono text-[0.8125rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink";

export const labelClass =
  "font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke";

/** Look up the first error message for a dotted path. */
export function errorFor(
  errors: FieldErrors | undefined,
  path: string,
): string | null {
  const list = errors?.[path];
  return list && list.length > 0 ? list[0] : null;
}

export function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="font-mono text-[0.6875rem] leading-snug text-soldout">
      {message}
    </p>
  );
}

interface BaseProps {
  label?: string;
  hint?: string;
  path?: string;
  errors?: FieldErrors;
  className?: string;
}

/** Labelled text input + inline field error. */
export function TextField({
  label,
  hint,
  path,
  errors,
  className,
  id,
  ...props
}: BaseProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const err = path ? errorFor(errors, path) : null;
  const fieldId = id ?? path;
  return (
    <label className={cn("flex flex-col gap-1.5", className)} htmlFor={fieldId}>
      {label ? <span className={labelClass}>{label}</span> : null}
      <input
        id={fieldId}
        className={cn(controlClass, err && "border-soldout")}
        aria-invalid={err ? true : undefined}
        {...props}
      />
      {hint && !err ? (
        <span className="font-mono text-[0.6875rem] text-smoke">{hint}</span>
      ) : null}
      <FieldError message={err} />
    </label>
  );
}

/** Labelled textarea + inline field error. */
export function TextAreaField({
  label,
  hint,
  path,
  errors,
  className,
  id,
  ...props
}: BaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const err = path ? errorFor(errors, path) : null;
  const fieldId = id ?? path;
  return (
    <label className={cn("flex flex-col gap-1.5", className)} htmlFor={fieldId}>
      {label ? <span className={labelClass}>{label}</span> : null}
      <textarea
        id={fieldId}
        className={cn(
          controlClass,
          "min-h-[5rem] resize-y",
          err && "border-soldout",
        )}
        aria-invalid={err ? true : undefined}
        {...props}
      />
      {hint && !err ? (
        <span className="font-mono text-[0.6875rem] text-smoke">{hint}</span>
      ) : null}
      <FieldError message={err} />
    </label>
  );
}

/** Labelled native select + inline field error. */
export function SelectField({
  label,
  hint,
  path,
  errors,
  className,
  id,
  children,
  ...props
}: BaseProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const err = path ? errorFor(errors, path) : null;
  const fieldId = id ?? path;
  return (
    <label className={cn("flex flex-col gap-1.5", className)} htmlFor={fieldId}>
      {label ? <span className={labelClass}>{label}</span> : null}
      <select
        id={fieldId}
        className={cn(controlClass, "cursor-pointer", err && "border-soldout")}
        aria-invalid={err ? true : undefined}
        {...props}
      >
        {children}
      </select>
      {hint && !err ? (
        <span className="font-mono text-[0.6875rem] text-smoke">{hint}</span>
      ) : null}
      <FieldError message={err} />
    </label>
  );
}

/** A bare control-class input used inside tables/grids (no label wrapper). */
export function CellInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={cn(controlClass, "shadow-none", className)} {...props} />
  );
}
