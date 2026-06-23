/**
 * circuit.rocks — auth feature: login page.
 *
 * Ported from the old SSR `routes/login.tsx`. The server loader/action are gone:
 * the form is a react-hook-form + zodResolver form whose submit fires the
 * `useLogin` mutation (axios → POST /auth/login). Backend 400/401 errors are
 * mapped via `unwrapFieldErrors` onto fields + a form-level alert.
 *
 * CANONICAL PATTERN for a SIMPLE form page:
 *   - `useForm({ resolver: zodResolver(schema) })`
 *   - `onSubmit` → `mutation.mutateAsync(values)` inside try/catch
 *   - on error, `unwrapFieldErrors(err)` → `setError(field)` + a form message
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "~/components/ui/button";
import { unwrapFieldErrors } from "~/lib/axios";
import { useLogin } from "../hooks/use-login";
import { loginSchema, type LoginInput } from "../types/auth.types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const inputClass =
  "w-full border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.875rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink";
const labelClass =
  "font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke";

function Wordmark() {
  return (
    <Link
      to="/"
      className="inline-flex items-baseline gap-0.5 no-underline"
      aria-label="circuit.rocks home"
    >
      <span className="font-sans text-[20px] font-bold tracking-[-0.02em] text-ink">
        circuit
      </span>
      <span className="inline-block size-[7px] -translate-y-px border-2 border-line bg-signal" />
      <span className="font-mono text-[18px] font-bold text-ink">rocks</span>
    </Link>
  );
}

/** Inline Google "G" mark (multi-color). */
function GoogleG() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export function LoginPage({ next }: { next?: string }) {
  const login = useLogin(next);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register: field,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const googleHref = `${API_URL}/auth/google?next=${encodeURIComponent(
    next ?? "/",
  )}`;

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await login.mutateAsync(values);
    } catch (err) {
      const unwrapped = unwrapFieldErrors(err);
      if (unwrapped) {
        for (const [name, msgs] of Object.entries(unwrapped.fieldErrors)) {
          if (name === "email" || name === "password") {
            setError(name, { message: msgs[0] });
          }
        }
        setFormError(
          unwrapped.formErrors[0] ??
            (Object.keys(unwrapped.fieldErrors).length === 0
              ? "Invalid email or password"
              : null),
        );
      } else {
        setFormError("Invalid email or password");
      }
    }
  }

  const submitting = isSubmitting || login.isPending;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 flex justify-center">
          <Wordmark />
        </div>

        <div className="border-2 border-line bg-paper shadow-brutal">
          <div className="border-b-2 border-line px-6 py-5">
            <p className="cr-mono text-smoke">// account</p>
            <h1 className="mt-1 font-sans text-[1.75rem] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
              Sign in
            </h1>
          </div>

          <div className="flex flex-col gap-5 p-6">
            {formError ? (
              <p
                role="alert"
                className="cr-mono border-2 border-soldout bg-paper px-3 py-2 text-[0.8125rem] text-soldout"
              >
                {formError}
              </p>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputClass}
                  aria-invalid={errors.email ? true : undefined}
                  {...field("email")}
                />
                {errors.email ? (
                  <p className="font-mono text-[0.6875rem] text-soldout">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={inputClass}
                  aria-invalid={errors.password ? true : undefined}
                  {...field("password")}
                />
                {errors.password ? (
                  <p className="font-mono text-[0.6875rem] text-soldout">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-0.5 flex-1 bg-line" />
              <span className="cr-mono text-smoke">or</span>
              <span className="h-0.5 flex-1 bg-line" />
            </div>

            <Button asChild variant="secondary" size="lg" className="w-full">
              <a href={googleHref}>
                <GoogleG />
                Continue with Google
              </a>
            </Button>
          </div>

          <div className="border-t-2 border-line px-6 py-4">
            <p className="font-mono text-[0.8125rem] text-smoke">
              No account?{" "}
              <Link
                to="/register"
                search={next ? { next } : undefined}
                className="font-bold text-ink underline-offset-2 hover:underline"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
