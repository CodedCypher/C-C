/**
 * circuit.rocks — auth feature: register page.
 *
 * Ported from the old SSR `routes/register.tsx`. react-hook-form + zodResolver;
 * submit fires the `useRegister` mutation (axios → POST /auth/register). A 409
 * (email exists) or other 400 maps via `unwrapFieldErrors` onto fields + a
 * form-level alert. Same simple-form template as `login-page`.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "~/components/ui/button";
import { unwrapFieldErrors } from "~/lib/axios";
import { useRegister } from "../hooks/use-register";
import { registerSchema, type RegisterInput } from "../types/auth.types";

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

export function RegisterPage({ next }: { next?: string }) {
  const registerMutation = useRegister(next);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register: field,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", firstName: "", lastName: "" },
  });

  const googleHref = `${API_URL}/auth/google?next=${encodeURIComponent(
    next ?? "/",
  )}`;

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    // Omit blank optional names so we never send "".
    const body: RegisterInput = {
      email: values.email,
      password: values.password,
      firstName: values.firstName?.trim() || undefined,
      lastName: values.lastName?.trim() || undefined,
    };
    try {
      await registerMutation.mutateAsync(body);
    } catch (err) {
      const unwrapped = unwrapFieldErrors(err);
      if (unwrapped) {
        for (const [name, msgs] of Object.entries(unwrapped.fieldErrors)) {
          if (
            name === "email" ||
            name === "password" ||
            name === "firstName" ||
            name === "lastName"
          ) {
            setError(name, { message: msgs[0] });
          }
        }
        setFormError(
          unwrapped.formErrors[0] ??
            (Object.keys(unwrapped.fieldErrors).length === 0
              ? "An account with that email already exists"
              : null),
        );
      } else {
        setFormError(
          "Something went wrong creating your account. Please try again.",
        );
      }
    }
  }

  const submitting = isSubmitting || registerMutation.isPending;

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
              Create account
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="firstName" className={labelClass}>
                    First name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    autoComplete="given-name"
                    placeholder="Ada"
                    className={inputClass}
                    {...field("firstName")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="lastName" className={labelClass}>
                    Last name{" "}
                    <span className="font-normal normal-case text-dark-meta">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    autoComplete="family-name"
                    placeholder="Lovelace"
                    className={inputClass}
                    {...field("lastName")}
                  />
                </div>
              </div>

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
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-describedby="password-hint"
                  className={inputClass}
                  aria-invalid={errors.password ? true : undefined}
                  {...field("password")}
                />
                <p
                  id="password-hint"
                  className={
                    errors.password
                      ? "font-mono text-[0.75rem] text-soldout"
                      : "font-mono text-[0.75rem] text-smoke"
                  }
                >
                  {errors.password?.message ?? "At least 8 characters."}
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? "Creating account…" : "Create account"}
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
              Already have an account?{" "}
              <Link
                to="/login"
                search={next ? { next } : undefined}
                className="font-bold text-ink underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
