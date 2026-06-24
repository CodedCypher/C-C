/**
 * circuit.rocks — storefront: PH cascading-address form fields.
 *
 * The single implementation of the delivery-address form: line1/line2 + the
 * cascading region → province → city/municipality → barangay <select>s +
 * postal code. Extracted from the checkout wizard so the account "addresses"
 * CRUD and checkout share ONE address form.
 *
 * Controlled: the parent owns the `value` (codes drive the cascade, names are
 * snapshotted alongside) and applies field patches via `onChange`. The cascade
 * data hooks live here — each <select> enables once its parent code is set, and
 * choosing a level clears every level below it (so a stale province can't hang
 * around under a new region).
 */

import {
  useBarangays,
  useCityMun,
  useProvinces,
  useRegions,
} from "../hooks/use-storefront";

const inputClass =
  "w-full border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.875rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink";
const labelClass =
  "font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke";
const errClass = "font-mono text-[0.6875rem] text-soldout";

/**
 * The address fields this component reads + patches. The parent stores both the
 * `*Code` (drives the cascade) and the human-readable name (snapshotted for the
 * order payload) for each level.
 */
export interface CascadeAddressValue {
  line1: string;
  line2: string;
  postalCode: string;
  region: string;
  regionCode: string;
  province: string;
  provinceCode: string;
  city: string;
  cityCode: string;
  barangay: string;
  barangayCode: string;
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

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
  loading,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { code: string; name: string }[];
  disabled?: boolean;
  loading?: boolean;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelClass}>{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} disabled:opacity-50`}
      >
        <option value="">{loading ? "Loading…" : placeholder}</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AddressCascadeFields({
  value,
  onChange,
  errors,
}: {
  value: CascadeAddressValue;
  /** Apply a partial patch to the address value (parent merges it in). */
  onChange: (patch: Partial<CascadeAddressValue>) => void;
  /** Per-field errors keyed by the order-payload field name (e.g. shipLine1). */
  errors?: Record<string, string | undefined>;
}) {
  const regions = useRegions();
  const provinces = useProvinces(value.regionCode || undefined);
  const cityMun = useCityMun(value.provinceCode || undefined);
  const barangays = useBarangays(value.cityCode || undefined);

  function setRegion(code: string) {
    const name = regions.data?.find((r) => r.code === code)?.name ?? "";
    onChange({
      regionCode: code,
      region: name,
      provinceCode: "",
      province: "",
      cityCode: "",
      city: "",
      barangayCode: "",
      barangay: "",
    });
  }
  function setProvince(code: string) {
    const name = provinces.data?.find((r) => r.code === code)?.name ?? "";
    onChange({
      provinceCode: code,
      province: name,
      cityCode: "",
      city: "",
      barangayCode: "",
      barangay: "",
    });
  }
  function setCity(code: string) {
    const name = cityMun.data?.find((r) => r.code === code)?.name ?? "";
    onChange({ cityCode: code, city: name, barangayCode: "", barangay: "" });
  }
  function setBarangay(code: string) {
    const name = barangays.data?.find((r) => r.code === code)?.name ?? "";
    onChange({ barangayCode: code, barangay: name });
  }

  return (
    <div className="flex flex-col gap-4">
      <Text
        label="House / street / unit"
        value={value.line1}
        onChange={(v) => onChange({ line1: v })}
        error={errors?.shipLine1}
      />
      <Text
        label="Apartment, suite (optional)"
        value={value.line2}
        onChange={(v) => onChange({ line2: v })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Region"
          value={value.regionCode}
          onChange={setRegion}
          options={regions.data ?? []}
          loading={regions.isLoading}
          placeholder="Select region"
        />
        <Select
          label="Province"
          value={value.provinceCode}
          onChange={setProvince}
          options={provinces.data ?? []}
          disabled={!value.regionCode}
          loading={provinces.isFetching}
          placeholder="Select province"
        />
        <Select
          label="City / Municipality"
          value={value.cityCode}
          onChange={setCity}
          options={cityMun.data ?? []}
          disabled={!value.provinceCode}
          loading={cityMun.isFetching}
          placeholder="Select city / municipality"
        />
        <Select
          label="Barangay"
          value={value.barangayCode}
          onChange={setBarangay}
          options={barangays.data ?? []}
          disabled={!value.cityCode}
          loading={barangays.isFetching}
          placeholder="Select barangay"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Text
          label="Postal code"
          value={value.postalCode}
          onChange={(v) => onChange({ postalCode: v })}
          error={errors?.shipPostal}
        />
      </div>
    </div>
  );
}
