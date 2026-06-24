/**
 * circuit.rocks — account feature: saved-address form (create + edit).
 *
 * Wraps the shared `<AddressCascadeFields>` with the contact fields (name +
 * phone) and a "set as default" toggle, producing a `CreateAddressInput`. Used
 * for BOTH create (no `initial`) and edit (seeded from a `SavedAddress`). The
 * cascade is custom-state driven (matching checkout), so this form manages its
 * own local state rather than react-hook-form. On submit it calls the passed
 * `onSubmit` handler; backend validation errors are mapped back onto fields via
 * `unwrapFieldErrors`.
 */

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { unwrapFieldErrors } from "~/lib/axios";
import {
  AddressCascadeFields,
  type CascadeAddressValue,
} from "~/features/storefront/components/address-cascade-fields";
import type {
  CreateAddressInput,
  SavedAddress,
} from "~/features/storefront";

const inputClass =
  "w-full border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.875rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink";
const labelClass =
  "font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke";
const errClass = "font-mono text-[0.6875rem] text-soldout";

/** The full address-form state: contact + the cascade fields + default flag. */
interface FormState extends CascadeAddressValue {
  name: string;
  phone: string;
  country: string;
  isDefault: boolean;
}

const EMPTY: FormState = {
  name: "",
  phone: "",
  line1: "",
  line2: "",
  postalCode: "",
  region: "",
  regionCode: "",
  province: "",
  provinceCode: "",
  city: "",
  cityCode: "",
  barangay: "",
  barangayCode: "",
  country: "Philippines",
  isDefault: false,
};

function fromSaved(s: SavedAddress): FormState {
  return {
    name: s.name,
    phone: s.phone ?? "",
    line1: s.line1,
    line2: s.line2 ?? "",
    postalCode: s.postalCode,
    region: s.region,
    regionCode: s.regionCode ?? "",
    province: s.province ?? "",
    provinceCode: s.provinceCode ?? "",
    city: s.city,
    cityCode: s.cityCode ?? "",
    barangay: s.barangay ?? "",
    barangayCode: s.barangayCode ?? "",
    country: s.country,
    isDefault: s.isDefault,
  };
}

function Text({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelClass}>{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        aria-invalid={error ? true : undefined}
      />
      {error ? <p className={errClass}>{error}</p> : null}
    </div>
  );
}

export function AddressForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  /** When present the form edits this saved address; otherwise it creates one. */
  initial?: SavedAddress;
  submitting?: boolean;
  /** Persist the address. Throw to surface backend field errors on the form. */
  onSubmit: (body: CreateAddressInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [state, setState] = useState<FormState>(
    initial ? fromSaved(initial) : EMPTY,
  );
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function err(key: string): string | undefined {
    return fieldErr[key];
  }

  function patch(next: Partial<FormState>) {
    setState((s) => ({ ...s, ...next }));
  }

  /** Client-side required-field check before hitting the backend. */
  function localValidate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!state.name.trim()) e.name = "Required";
    if (!state.phone.trim()) e.phone = "Required";
    if (!state.line1.trim()) e.line1 = "Required";
    if (!state.regionCode) e.region = "Select a region";
    if (!state.provinceCode) e.province = "Select a province";
    if (!state.cityCode) e.city = "Select a city / municipality";
    if (!state.barangayCode) e.barangay = "Select a barangay";
    if (!state.postalCode.trim()) e.postalCode = "Required";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const local = localValidate();
    if (Object.keys(local).length) {
      setFieldErr(local);
      return;
    }
    setFieldErr({});

    const body: CreateAddressInput = {
      name: state.name.trim(),
      phone: state.phone.trim(),
      line1: state.line1.trim(),
      line2: state.line2.trim() || undefined,
      barangay: state.barangay,
      city: state.city,
      province: state.province,
      region: state.region,
      postalCode: state.postalCode.trim(),
      country: state.country || "Philippines",
      regionCode: state.regionCode,
      provinceCode: state.provinceCode,
      cityCode: state.cityCode,
      barangayCode: state.barangayCode,
      isDefault: state.isDefault,
    };

    try {
      await onSubmit(body);
    } catch (caught) {
      const unwrapped = unwrapFieldErrors(caught);
      if (unwrapped) {
        const mapped: Record<string, string> = {};
        for (const [key, msgs] of Object.entries(unwrapped.fieldErrors)) {
          mapped[key] = msgs[0];
        }
        setFieldErr(mapped);
        setFormError(unwrapped.formErrors[0] ?? null);
      } else {
        setFormError("Could not save the address. Please try again.");
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 border-2 border-line bg-paper p-6 shadow-brutal"
    >
      {formError ? (
        <p
          role="alert"
          className="cr-mono border-2 border-soldout bg-paper px-3 py-2 text-[0.8125rem] text-soldout"
        >
          {formError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Text
          label="Full name"
          value={state.name}
          onChange={(v) => patch({ name: v })}
          error={err("name")}
        />
        <Text
          label="Mobile number"
          value={state.phone}
          onChange={(v) => patch({ phone: v })}
          placeholder="09xx xxx xxxx"
          error={err("phone")}
        />
      </div>

      <AddressCascadeFields
        value={state}
        onChange={patch}
        errors={{
          shipLine1: err("line1"),
          shipPostal: err("postalCode"),
        }}
      />

      {/* Cascade-level errors (the cascade component shows line1/postal only). */}
      {(err("region") ||
        err("province") ||
        err("city") ||
        err("barangay")) && (
        <p className={errClass}>
          {err("region") ?? err("province") ?? err("city") ?? err("barangay")}
        </p>
      )}

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={state.isDefault}
          onChange={(e) => patch({ isDefault: e.target.checked })}
          className="size-4 accent-signal"
        />
        <span className="font-mono text-[0.8125rem] text-ink">
          Set as default delivery address
        </span>
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="md" disabled={submitting}>
          {submitting
            ? "Saving…"
            : initial
              ? "Save changes"
              : "Add address"}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
