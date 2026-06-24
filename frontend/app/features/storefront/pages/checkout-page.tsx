/**
 * circuit.rocks — storefront checkout (public route /checkout).
 *
 * A 3-step wizard:
 *   1. Contact + fulfillment choice. Signed-in shoppers get name/email from
 *      their account (mobile editable); guests fill all three. For DELIVERY the
 *      address is built here from cascading PH dropdowns (region → province →
 *      city/municipality → barangay), with a saved-address picker for signed-in
 *      users. PICKUP skips the address.
 *   2. Fulfillment detail — pick a branch (pickup) or confirm the address (delivery).
 *   3. Payment — pick an admin-managed method (QR if any), enter a required
 *      reference, upload a required proof image.
 *
 * "Place order" posts everything as multipart to POST /storefront/checkout,
 * creating a PENDING Order + PENDING Payment. Backend 400s map back onto fields
 * via `unwrapFieldErrors`; success shows the order-number confirmation.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ShoppingCart } from "lucide-react";

import { Button } from "~/components/ui/button";
import { peso2 } from "~/lib/format";
import { unwrapFieldErrors } from "~/lib/axios";
import { useAuth } from "~/features/auth";

import {
  useBranches,
  useCart,
  useCheckout,
  useCreateAddress,
  useMyAddresses,
  usePaymentMethods,
} from "../hooks/use-storefront";
import {
  AddressCascadeFields,
  type CascadeAddressValue,
} from "../components/address-cascade-fields";
import type {
  CheckoutResult,
  FulfillmentType,
  SavedAddress,
} from "../types/storefront.types";

const MAXW = "mx-auto max-w-[980px]";
const inputClass =
  "w-full border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.875rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink";
const labelClass =
  "font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke";
const errClass = "font-mono text-[0.6875rem] text-soldout";

/** Backend static-file origin (QR images live under /uploads on the API host). */
const FILE_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

/** A delivery address resolved into the exact ship-* fields the order needs. */
interface ResolvedAddress {
  line1: string;
  line2: string;
  barangay: string;
  city: string;
  province: string;
  region: string;
  postalCode: string;
  country: string;
  regionCode: string;
  provinceCode: string;
  cityCode: string;
  barangayCode: string;
}

/** The new-address form state (codes drive the cascade, names are snapshotted). */
type NewAddr = ResolvedAddress;

const EMPTY_ADDR: NewAddr = {
  line1: "",
  line2: "",
  barangay: "",
  city: "",
  province: "",
  region: "",
  postalCode: "",
  country: "Philippines",
  regionCode: "",
  provinceCode: "",
  cityCode: "",
  barangayCode: "",
};

function newAddrComplete(a: NewAddr): boolean {
  return Boolean(
    a.line1.trim() &&
      a.regionCode &&
      a.provinceCode &&
      a.cityCode &&
      a.barangayCode &&
      a.postalCode.trim(),
  );
}

function savedToResolved(s: SavedAddress): ResolvedAddress {
  return {
    line1: s.line1,
    line2: s.line2 ?? "",
    barangay: s.barangay ?? "",
    city: s.city,
    province: s.province ?? "",
    region: s.region,
    postalCode: s.postalCode,
    country: s.country,
    regionCode: s.regionCode ?? "",
    provinceCode: s.provinceCode ?? "",
    cityCode: s.cityCode ?? "",
    barangayCode: s.barangayCode ?? "",
  };
}

function Text({
  label,
  value,
  onChange,
  error,
  type = "text",
  readOnly,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  error?: string;
  type?: string;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`${inputClass} ${readOnly ? "opacity-70" : ""}`}
        aria-invalid={error ? true : undefined}
      />
      {error ? <p className={errClass}>{error}</p> : null}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["Contact", "Fulfillment", "Payment"];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center border-2 font-mono text-[0.75rem] font-bold ${
                active || done
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-paper text-smoke"
              }`}
            >
              {n}
            </span>
            <span
              className={`font-mono text-[0.6875rem] uppercase tracking-[0.08em] ${
                active ? "text-ink" : "text-smoke"
              }`}
            >
              {s}
            </span>
            {n < 3 ? <span className="mx-1 text-line">/</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export function CheckoutPage() {
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const { data: cart } = useCart();
  const checkout = useCheckout();
  const createAddress = useCreateAddress();

  const [step, setStep] = useState(1);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  // Contact
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(
    [user?.firstName, user?.lastName].filter(Boolean).join(" "),
  );
  const [mobile, setMobile] = useState("");

  // Fulfillment
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("DELIVERY");
  const [branchId, setBranchId] = useState<string | null>(null);

  // Delivery address
  const { data: savedAddresses } = useMyAddresses(signedIn);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [addingNew, setAddingNew] = useState(false);
  const [addr, setAddr] = useState<NewAddr>(EMPTY_ADDR);

  // Preselect the default saved address (falling back to the first) once the
  // signed-in shopper's addresses load, so checkout starts on a ready choice.
  useEffect(() => {
    if (selectedAddressId || !savedAddresses?.length) return;
    const preferred =
      savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    setSelectedAddressId(preferred.id);
  }, [savedAddresses, selectedAddressId]);

  // Payment
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);

  const branches = useBranches();
  const methods = usePaymentMethods();

  // Whether the new-address form is the active source (guests always; signed-in
  // when they chose "add new" or have no saved addresses).
  const hasSaved = signedIn && (savedAddresses?.length ?? 0) > 0;
  const usingNew = !hasSaved || addingNew;

  function err(name: string): string | undefined {
    return fieldErr[name];
  }

  /** Merge a cascade-field patch into the new-address form state. */
  function patchAddr(patch: Partial<CascadeAddressValue>) {
    setAddr((a) => ({ ...a, ...patch }));
  }

  /** The chosen delivery address (saved row or the new form), or null. */
  const delivery: ResolvedAddress | null = useMemo(() => {
    if (fulfillment !== "DELIVERY") return null;
    if (!usingNew && selectedAddressId) {
      const s = savedAddresses?.find((a) => a.id === selectedAddressId);
      return s ? savedToResolved(s) : null;
    }
    return newAddrComplete(addr) ? addr : null;
  }, [fulfillment, usingNew, selectedAddressId, savedAddresses, addr]);

  /* ---------------------------------------------------------------- *
   * Step navigation
   * ---------------------------------------------------------------- */

  async function next() {
    setFormError(null);
    setFieldErr({});

    if (step === 1) {
      const e: Record<string, string> = {};
      if (!email.trim()) e.email = "Required";
      if (!name.trim()) e.shipName = "Required";
      if (!mobile.trim()) e.shipPhone = "Required";

      if (fulfillment === "DELIVERY") {
        if (!usingNew && !selectedAddressId) {
          e.address = "Select or add a delivery address";
        } else if (usingNew && !newAddrComplete(addr)) {
          e.address = "Complete the delivery address";
        }
      }
      if (Object.keys(e).length) {
        setFieldErr(e);
        return;
      }

      // Persist a brand-new address for signed-in shoppers so it's reusable.
      if (signedIn && fulfillment === "DELIVERY" && usingNew) {
        try {
          const saved = await createAddress.mutateAsync({
            name: name.trim(),
            phone: mobile.trim(),
            line1: addr.line1.trim(),
            line2: addr.line2.trim() || undefined,
            barangay: addr.barangay,
            city: addr.city,
            province: addr.province,
            region: addr.region,
            postalCode: addr.postalCode.trim(),
            country: addr.country,
            regionCode: addr.regionCode,
            provinceCode: addr.provinceCode,
            cityCode: addr.cityCode,
            barangayCode: addr.barangayCode,
            isDefault: !hasSaved,
          });
          setSelectedAddressId(saved.id);
          setAddingNew(false);
        } catch {
          setFormError("Could not save your address. Please try again.");
          return;
        }
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (fulfillment === "PICKUP" && !branchId) {
        setFieldErr({ branchId: "Select a pickup branch" });
        return;
      }
      setStep(3);
      return;
    }
  }

  function back() {
    setFormError(null);
    setFieldErr({});
    setStep((s) => Math.max(1, s - 1));
  }

  /* ---------------------------------------------------------------- *
   * Final submit
   * ---------------------------------------------------------------- */

  async function placeOrder() {
    setFormError(null);
    setFieldErr({});

    const e: Record<string, string> = {};
    if (!paymentMethodId) e.paymentMethodId = "Select a payment method";
    if (!reference.trim()) e.reference = "Reference number is required";
    if (!proof) e.proof = "Upload your proof of payment";
    if (Object.keys(e).length) {
      setFieldErr(e);
      return;
    }

    const form = new FormData();
    form.set("email", email.trim());
    form.set("shipName", name.trim());
    form.set("shipPhone", mobile.trim());
    form.set("fulfillmentType", fulfillment);
    form.set("paymentMethodId", paymentMethodId as string);
    form.set("reference", reference.trim());
    form.set("proof", proof as File);

    if (fulfillment === "PICKUP") {
      form.set("branchId", branchId as string);
    } else if (delivery) {
      form.set("shipLine1", delivery.line1);
      if (delivery.line2) form.set("shipLine2", delivery.line2);
      form.set("shipBarangay", delivery.barangay);
      form.set("shipCity", delivery.city);
      form.set("shipProvince", delivery.province);
      form.set("shipRegion", delivery.region);
      form.set("shipPostal", delivery.postalCode);
      form.set("shipCountry", delivery.country || "Philippines");
      form.set("regionCode", delivery.regionCode);
      form.set("provinceCode", delivery.provinceCode);
      form.set("cityCode", delivery.cityCode);
      form.set("barangayCode", delivery.barangayCode);
    }

    try {
      const res = await checkout.mutateAsync(form);
      setResult(res);
    } catch (caught) {
      const unwrapped = unwrapFieldErrors(caught);
      if (unwrapped) {
        const mapped: Record<string, string> = {};
        for (const [key, msgs] of Object.entries(unwrapped.fieldErrors)) {
          mapped[key] = msgs[0];
        }
        setFieldErr(mapped);
        setFormError(unwrapped.formErrors[0] ?? null);
        // Surface address/contact errors back on step 1.
        const step1Keys = [
          "email",
          "shipName",
          "shipPhone",
          "shipLine1",
          "shipBarangay",
          "shipCity",
          "shipProvince",
          "shipRegion",
          "shipPostal",
          "branchId",
        ];
        if (step1Keys.some((k) => k in mapped)) {
          setFormError(
            unwrapped.formErrors[0] ?? "Please review your details.",
          );
          setStep(fulfillment === "PICKUP" ? 2 : 1);
        }
      } else {
        setFormError("Could not place your order. Please try again.");
      }
    }
  }

  /* ----- Success confirmation ----- */
  if (result) {
    return (
      <div
        className={`${MAXW} flex flex-col items-center gap-4 px-6 py-24 text-center`}
      >
        <CheckCircle2 className="h-12 w-12 text-stock" strokeWidth={1.5} />
        <h1 className="font-sans text-[2rem] font-bold tracking-[-0.02em] text-ink">
          Order placed
        </h1>
        <p className="text-smoke">
          Thanks! Your order{" "}
          <span className="font-mono font-bold text-ink">
            {result.orderNumber}
          </span>{" "}
          is in. Total{" "}
          <span className="font-mono font-bold text-ink">
            {peso2(result.grandTotal)}
          </span>
          . We'll verify your payment and email you shortly.
        </p>
        <Button asChild variant="primary" size="lg">
          <Link to="/">Continue shopping →</Link>
        </Button>
      </div>
    );
  }

  /* ----- Empty cart ----- */
  if (cart && cart.lines.length === 0) {
    return (
      <div
        className={`${MAXW} flex flex-col items-center gap-4 px-6 py-24 text-center`}
      >
        <ShoppingCart className="h-12 w-12 text-smoke" strokeWidth={1.5} />
        <h1 className="font-sans text-[1.75rem] font-bold tracking-[-0.02em] text-ink">
          Your cart is empty
        </h1>
        <p className="text-smoke">Add a few parts before checking out.</p>
        <Button asChild variant="primary">
          <Link to="/">Back to shop</Link>
        </Button>
      </div>
    );
  }

  const busy =
    checkout.isPending || createAddress.isPending || branches.isFetching;

  return (
    <div className={`${MAXW} flex flex-col gap-6 px-6 py-12`}>
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to shop
        </Link>
      </Button>

      <div className="flex flex-col gap-3">
        <p className="cr-mono text-smoke">// checkout</p>
        <h1 className="font-sans text-[2rem] font-bold tracking-[-0.02em] text-ink">
          Checkout
        </h1>
        <Stepper step={step} />
      </div>

      <div className="grid gap-8 md:grid-cols-[1.4fr_0.6fr]">
        <div className="border-2 border-line bg-paper p-6 shadow-brutal">
          {formError ? (
            <p
              role="alert"
              className="cr-mono mb-4 border-2 border-soldout bg-paper px-3 py-2 text-[0.8125rem] text-soldout"
            >
              {formError}
            </p>
          ) : null}

          {/* ---------------- Step 1: contact + fulfillment ---------------- */}
          {step === 1 ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                <h2 className="font-sans text-[1.1rem] font-bold text-ink">
                  Contact
                </h2>
                <Text
                  label="Full name"
                  value={name}
                  onChange={setName}
                  error={err("shipName")}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Text
                    label="Email"
                    type="email"
                    value={email}
                    onChange={signedIn ? undefined : setEmail}
                    readOnly={signedIn}
                    error={err("email")}
                  />
                  <Text
                    label="Mobile number"
                    value={mobile}
                    onChange={setMobile}
                    placeholder="09xx xxx xxxx"
                    error={err("shipPhone")}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="font-sans text-[1.1rem] font-bold text-ink">
                  Fulfillment
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {(["DELIVERY", "PICKUP"] as FulfillmentType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFulfillment(t)}
                      className={`border-2 px-4 py-3 text-left font-mono text-[0.8125rem] font-bold uppercase tracking-[0.06em] shadow-press ${
                        fulfillment === t
                          ? "border-ink bg-ink text-paper"
                          : "border-line bg-paper text-smoke"
                      }`}
                    >
                      {t === "DELIVERY" ? "Deliver to me" : "Pick up at branch"}
                    </button>
                  ))}
                </div>
              </div>

              {fulfillment === "DELIVERY" ? (
                <div className="flex flex-col gap-4 border-t-2 border-line pt-4">
                  <h2 className="font-sans text-[1.1rem] font-bold text-ink">
                    Delivery address
                  </h2>

                  {hasSaved ? (
                    <div className="flex flex-col gap-2">
                      {savedAddresses!.map((a) => (
                        <label
                          key={a.id}
                          className={`flex cursor-pointer items-start gap-3 border-2 p-3 ${
                            !addingNew && selectedAddressId === a.id
                              ? "border-ink bg-paper-2"
                              : "border-line bg-paper"
                          }`}
                        >
                          <input
                            type="radio"
                            name="savedAddr"
                            className="mt-1"
                            checked={!addingNew && selectedAddressId === a.id}
                            onChange={() => {
                              setAddingNew(false);
                              setSelectedAddressId(a.id);
                            }}
                          />
                          <span className="text-[0.8125rem] text-ink">
                            <span className="font-bold">{a.name}</span> ·{" "}
                            {a.phone}
                            <br />
                            {a.line1}
                            {a.line2 ? `, ${a.line2}` : ""}, {a.barangay},{" "}
                            {a.city}, {a.province}, {a.region} {a.postalCode}
                          </span>
                        </label>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAddingNew((v) => !v)}
                        className="self-start font-mono text-[0.75rem] font-bold uppercase tracking-[0.06em] text-ink underline"
                      >
                        {addingNew ? "− Use a saved address" : "＋ New address"}
                      </button>
                    </div>
                  ) : null}

                  {usingNew ? (
                    <AddressCascadeFields
                      value={addr}
                      onChange={patchAddr}
                      errors={{
                        shipLine1: err("shipLine1"),
                        shipPostal: err("shipPostal"),
                      }}
                    />
                  ) : null}

                  {err("address") ? (
                    <p className={errClass}>{err("address")}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ---------------- Step 2: fulfillment detail ---------------- */}
          {step === 2 ? (
            <div className="flex flex-col gap-4">
              {fulfillment === "PICKUP" ? (
                <>
                  <h2 className="font-sans text-[1.1rem] font-bold text-ink">
                    Choose a pickup branch
                  </h2>
                  {branches.isLoading ? (
                    <p className="text-smoke">Loading branches…</p>
                  ) : (branches.data?.length ?? 0) === 0 ? (
                    <p className="text-smoke">No branches available.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {branches.data!.map((b) => (
                        <label
                          key={b.id}
                          className={`flex cursor-pointer items-start gap-3 border-2 p-3 ${
                            branchId === b.id
                              ? "border-ink bg-paper-2"
                              : "border-line bg-paper"
                          }`}
                        >
                          <input
                            type="radio"
                            name="branch"
                            className="mt-1"
                            checked={branchId === b.id}
                            onChange={() => setBranchId(b.id)}
                          />
                          <span className="text-[0.8125rem] text-ink">
                            <span className="font-bold">{b.name}</span>
                            <br />
                            {[b.line1, b.city, b.region]
                              .filter(Boolean)
                              .join(", ")}
                            {b.phone ? ` · ${b.phone}` : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {err("branchId") ? (
                    <p className={errClass}>{err("branchId")}</p>
                  ) : null}
                </>
              ) : (
                <>
                  <h2 className="font-sans text-[1.1rem] font-bold text-ink">
                    Deliver to
                  </h2>
                  {delivery ? (
                    <div className="border-2 border-line bg-paper-2 p-4 text-[0.8125rem] text-ink">
                      <p className="font-bold">
                        {name} · {mobile}
                      </p>
                      <p>
                        {delivery.line1}
                        {delivery.line2 ? `, ${delivery.line2}` : ""},{" "}
                        {delivery.barangay}, {delivery.city},{" "}
                        {delivery.province}, {delivery.region}{" "}
                        {delivery.postalCode}
                      </p>
                    </div>
                  ) : (
                    <p className={errClass}>
                      No address selected — go back to step 1.
                    </p>
                  )}
                </>
              )}
            </div>
          ) : null}

          {/* ---------------- Step 3: payment ---------------- */}
          {step === 3 ? (
            <div className="flex flex-col gap-5">
              <h2 className="font-sans text-[1.1rem] font-bold text-ink">
                Payment method
              </h2>
              {methods.isLoading ? (
                <p className="text-smoke">Loading payment methods…</p>
              ) : (methods.data?.length ?? 0) === 0 ? (
                <p className="text-smoke">
                  No payment methods are configured yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {methods.data!.map((m) => (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer flex-col gap-2 border-2 p-3 ${
                        paymentMethodId === m.id
                          ? "border-ink bg-paper-2"
                          : "border-line bg-paper"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="method"
                          className="mt-1"
                          checked={paymentMethodId === m.id}
                          onChange={() => setPaymentMethodId(m.id)}
                        />
                        <span className="text-[0.8125rem] text-ink">
                          <span className="font-bold">{m.name}</span>
                          {m.instructions ? (
                            <span className="mt-0.5 block whitespace-pre-line text-smoke">
                              {m.instructions}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      {paymentMethodId === m.id && m.qrImageUrl ? (
                        <img
                          src={`${FILE_BASE}${m.qrImageUrl}`}
                          alt={`${m.name} QR`}
                          className="h-40 w-40 border-2 border-line object-contain"
                        />
                      ) : null}
                    </label>
                  ))}
                </div>
              )}
              {err("paymentMethodId") ? (
                <p className={errClass}>{err("paymentMethodId")}</p>
              ) : null}

              <Text
                label="Reference number"
                value={reference}
                onChange={setReference}
                placeholder="e.g. GCash ref / bank txn no."
                error={err("reference")}
              />

              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Proof of payment</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                  className="font-mono text-[0.8125rem] text-ink file:mr-3 file:border-2 file:border-line file:bg-paper-2 file:px-3 file:py-1.5 file:font-mono file:text-[0.75rem] file:text-ink"
                />
                {proof ? (
                  <p className="font-mono text-[0.6875rem] text-smoke">
                    {proof.name}
                  </p>
                ) : null}
                {err("proof") ? <p className={errClass}>{err("proof")}</p> : null}
              </div>
            </div>
          ) : null}

          {/* ---------------- Nav buttons ---------------- */}
          <div className="mt-6 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={back} disabled={busy}>
                ← Back
              </Button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <Button variant="primary" size="lg" onClick={next} disabled={busy}>
                {busy ? "…" : "Continue →"}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={placeOrder}
                disabled={busy}
              >
                {busy ? "Placing order…" : "Place order →"}
              </Button>
            )}
          </div>
        </div>

        {/* Order summary */}
        <aside className="flex h-fit flex-col gap-3 border-2 border-line bg-paper-2 p-5 shadow-press">
          <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke">
            Order summary
          </span>
          <div className="flex flex-col gap-2">
            {(cart?.lines ?? []).map((line) => (
              <div
                key={line.variantId}
                className="flex justify-between gap-3 text-[0.8125rem]"
              >
                <span className="min-w-0 text-ink">
                  <span className="font-mono text-smoke">{line.quantity}×</span>{" "}
                  {line.name}
                </span>
                <span className="shrink-0 font-mono text-ink">
                  {peso2(line.lineTotal)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between border-t-2 border-line pt-3 font-mono text-[1rem] font-bold text-ink">
            <span>Total</span>
            <span>{peso2(cart?.subtotal ?? 0)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
