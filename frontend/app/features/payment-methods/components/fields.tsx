/**
 * circuit.rocks — payment-methods feature: brutalist field primitives.
 *
 * Feature-local input helpers (mirrors the branches field kit) so the long
 * neo-brutalist class string lives in one place. Each field takes a dotted
 * `path` + an `errors` map (from `unwrapFieldErrors().fieldErrors`) and renders
 * the message in red mono under the control. Do NOT import across features.
 */

import type * as React from "react";

import { cn } from "~/lib/utils";

export type FieldErrors = Record<string, string[]>;

export const controlClass =
  "w-full border-2 border-line bg-paper py-2.5 px-3 font-mono text-[0.8125rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink";

export const labelClass =
  "font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke";

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

/** A banner listing top-level (non-field) form errors. */
export function FormErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="border-2 border-soldout bg-soldout/10 px-3 py-2.5 shadow-press"
    >
      <ul className="flex flex-col gap-0.5">
        {errors.map((e, i) => (
          <li
            key={i}
            className="font-mono text-[0.75rem] leading-snug text-soldout"
          >
            {e}
          </li>
        ))}
      </ul>
    </div>
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
export function TextareaField({
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
        className={cn(controlClass, "min-h-[80px]", err && "border-soldout")}
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

/** A labelled checkbox row + inline field error (brutalist box). */
export function CheckboxField({
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
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={fieldId}
        className="flex cursor-pointer items-center gap-2.5"
      >
        <input
          id={fieldId}
          type="checkbox"
          className="size-4 shrink-0 cursor-pointer accent-signal outline-none focus-visible:ring-2 focus-visible:ring-ink"
          aria-invalid={err ? true : undefined}
          {...props}
        />
        {label ? (
          <span className="font-mono text-[0.8125rem] text-ink">{label}</span>
        ) : null}
      </label>
      {hint && !err ? (
        <span className="font-mono text-[0.6875rem] text-smoke">{hint}</span>
      ) : null}
      <FieldError message={err} />
    </div>
  );
}
