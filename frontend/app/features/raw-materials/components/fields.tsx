/**
 * circuit.rocks — raw-materials feature: brutalist field primitives.
 *
 * Co-located input helpers (mirrors products/components/product-form/fields.tsx)
 * so the long neo-brutalist class string lives in one place. Each field takes a
 * dotted `path` and an `errors` map (from `unwrapFieldErrors().fieldErrors`);
 * when present it renders the message in red mono under the control.
 *
 * The control class matches the inventory-list search controls:
 *   border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.8125rem]
 *   shadow-press focus-visible:ring-2 focus-visible:ring-ink
 */

import type * as React from "react";

import { cn } from "~/lib/utils";

export type FieldErrors = Record<string, string[]>;

/** The shared brutalist control class (input / select / textarea). */
export const controlClass =
  "w-full border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.8125rem] text-ink shadow-press outline-none transition-colors duration-150 placeholder:text-smoke hover:border-ink focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

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

function FieldError({ message }: { message: string | null }) {
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

/** A bare control-class input used inside grids (no label wrapper). */
export function CellInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={cn(controlClass, "shadow-none", className)} {...props} />
  );
}

/** A brutalist checkbox row: signal-accent box + label. */
export function CheckboxField({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 border-2 border-line bg-paper px-3 py-2.5 shadow-press transition-colors duration-150 hover:border-ink motion-reduce:transition-none",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-signal"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-mono text-[0.8125rem] font-bold text-ink">
          {label}
        </span>
        {hint ? (
          <span className="font-mono text-[0.6875rem] text-smoke">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

/** A small read-only key/value row used in the detail Sheet. */
export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b-2 border-line py-2 last:border-b-0">
      <span className={labelClass}>{label}</span>
      <span className="text-right font-mono text-[0.8125rem] text-ink">
        {children}
      </span>
    </div>
  );
}
