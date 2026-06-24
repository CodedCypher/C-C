/**
 * circuit.rocks — account feature: profile editor (route /account/profile).
 *
 * A simple react-hook-form + zodResolver form editing firstName / lastName /
 * phone / company / marketingOptIn (email is read-only). Prefilled from
 * `useMyProfile`; submit fires `useUpdateProfile` (PATCH /me/profile). Backend
 * validation errors map back onto fields via `unwrapFieldErrors`, and a success
 * indicator confirms the save.
 *
 * CANONICAL PATTERN for a SIMPLE form page:
 *   - `useForm({ resolver: zodResolver(schema) })`
 *   - `onSubmit` → `mutation.mutateAsync(values)` inside try/catch
 *   - on error, `unwrapFieldErrors(err)` → `setError(field)` + a form message
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { unwrapFieldErrors } from "~/lib/axios";
import { useMyProfile, useUpdateProfile } from "../hooks/use-account";

const inputClass =
  "w-full border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.875rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink";
const labelClass =
  "font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke";

/** Form schema: strings default to "" so RHF stays controlled. */
const profileFormSchema = z.object({
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  phone: z.string().max(40),
  company: z.string().max(120),
  marketingOptIn: z.boolean(),
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

const EMPTY: ProfileFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  company: "",
  marketingOptIn: false,
};

/** Form-field names that backend field errors may target. */
const FIELD_NAMES: (keyof ProfileFormValues)[] = [
  "firstName",
  "lastName",
  "phone",
  "company",
  "marketingOptIn",
];

export function ProfilePage() {
  const { data: profile, isLoading, isError } = useMyProfile();
  const update = useUpdateProfile();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register: field,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: EMPTY,
  });

  // Prefill once the profile loads (and whenever it changes server-side).
  useEffect(() => {
    if (!profile) return;
    reset({
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      phone: profile.phone ?? "",
      company: profile.company ?? "",
      marketingOptIn: profile.marketingOptIn,
    });
  }, [profile, reset]);

  async function onSubmit(values: ProfileFormValues) {
    setFormError(null);
    setSaved(false);
    try {
      await update.mutateAsync({
        firstName: values.firstName.trim() || undefined,
        lastName: values.lastName.trim() || undefined,
        phone: values.phone.trim() || undefined,
        company: values.company.trim() || undefined,
        marketingOptIn: values.marketingOptIn,
      });
      setSaved(true);
    } catch (err) {
      const unwrapped = unwrapFieldErrors(err);
      if (unwrapped) {
        for (const [name, msgs] of Object.entries(unwrapped.fieldErrors)) {
          if ((FIELD_NAMES as string[]).includes(name)) {
            setError(name as keyof ProfileFormValues, { message: msgs[0] });
          }
        }
        setFormError(unwrapped.formErrors[0] ?? null);
      } else {
        setFormError("Could not save your profile. Please try again.");
      }
    }
  }

  if (isLoading) {
    return (
      <p className="font-mono text-[0.8125rem] text-smoke">
        Loading your profile…
      </p>
    );
  }

  if (isError || !profile) {
    return (
      <p className="font-mono text-[0.8125rem] text-soldout">
        Could not load your profile. Please try again.
      </p>
    );
  }

  const submitting = isSubmitting || update.isPending;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-xl flex-col gap-5 border-2 border-line bg-paper p-6 shadow-brutal"
    >
      <h2 className="font-sans text-[1.25rem] font-bold tracking-[-0.01em] text-ink">
        Profile
      </h2>

      {formError ? (
        <p
          role="alert"
          className="cr-mono border-2 border-soldout bg-paper px-3 py-2 text-[0.8125rem] text-soldout"
        >
          {formError}
        </p>
      ) : null}

      {saved ? (
        <p className="cr-mono flex items-center gap-2 border-2 border-stock bg-paper px-3 py-2 text-[0.8125rem] text-stock">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Profile saved.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="firstName" className={labelClass}>
            First name
          </label>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            className={inputClass}
            aria-invalid={errors.firstName ? true : undefined}
            {...field("firstName")}
          />
          {errors.firstName ? (
            <p className="font-mono text-[0.6875rem] text-soldout">
              {errors.firstName.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="lastName" className={labelClass}>
            Last name
          </label>
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            className={inputClass}
            aria-invalid={errors.lastName ? true : undefined}
            {...field("lastName")}
          />
          {errors.lastName ? (
            <p className="font-mono text-[0.6875rem] text-soldout">
              {errors.lastName.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          type="email"
          value={profile.email}
          readOnly
          className={`${inputClass} opacity-70`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className={labelClass}>
            Mobile number
          </label>
          <input
            id="phone"
            type="text"
            autoComplete="tel"
            placeholder="09xx xxx xxxx"
            className={inputClass}
            aria-invalid={errors.phone ? true : undefined}
            {...field("phone")}
          />
          {errors.phone ? (
            <p className="font-mono text-[0.6875rem] text-soldout">
              {errors.phone.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="company" className={labelClass}>
            Company (optional)
          </label>
          <input
            id="company"
            type="text"
            autoComplete="organization"
            className={inputClass}
            aria-invalid={errors.company ? true : undefined}
            {...field("company")}
          />
          {errors.company ? (
            <p className="font-mono text-[0.6875rem] text-soldout">
              {errors.company.message}
            </p>
          ) : null}
        </div>
      </div>

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          className="size-4 accent-signal"
          {...field("marketingOptIn")}
        />
        <span className="font-mono text-[0.8125rem] text-ink">
          Email me about new products and promotions
        </span>
      </label>

      <div>
        <Button type="submit" variant="primary" size="md" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
