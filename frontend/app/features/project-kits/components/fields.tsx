/**
 * Brutalist form primitives local to the project-kits feature (features don't
 * share field helpers). Each control takes a dotted `path` + the `fieldErrors`
 * map from `unwrapFieldErrors()` and renders the matching message in red.
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
  return errors?.[path]?.[0] ?? null;
}

export function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <span className="font-mono text-[0.6875rem] leading-snug text-soldout">
      {message}
    </span>
  );
}

export function FormErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 border-2 border-soldout bg-soldout/10 px-3 py-2.5">
      {errors.map((e, i) => (
        <span
          key={i}
          className="font-mono text-[0.6875rem] leading-snug text-soldout"
        >
          {e}
        </span>
      ))}
    </div>
  );
}

interface BaseProps {
  label?: string;
  hint?: string;
  path?: string;
  errors?: FieldErrors;
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

/** Labelled multiline textarea + inline field error. */
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
        className={cn(controlClass, "resize-y", err && "border-soldout")}
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
