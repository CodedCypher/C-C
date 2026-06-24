/**
 * circuit.rocks — build-orders feature: create page (route /build-orders/new).
 *
 * A dedicated route (not a modal) for opening a build order: an output-variant
 * picker (searchable, only variants with an active BOM are selectable), a build
 * warehouse select, a planned quantity, and optional notes. Submits to
 * POST /build-orders; client-validates with the zod schema first, then maps any
 * backend 400/409 field errors back onto the controls via `unwrapFieldErrors`.
 *
 * The chosen variant carries its `activeBomId`, which we forward as `bomId` so
 * the backend pins the build to the current BOM version.
 */

import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "~/components/shared";
import { Button } from "~/components/ui/button";
import { unwrapFieldErrors } from "~/lib/axios";
import { useCreateBuildOrder } from "../hooks/use-create-build-order";
import { useBuildWarehouseOptions } from "../hooks/use-build-warehouse-options";
import { VariantPicker } from "../components/variant-picker";
import {
  FieldError,
  SelectField,
  TextAreaField,
  TextField,
  errorFor,
  labelClass,
  type FieldErrors,
} from "../components/fields";
import {
  createBuildOrderSchema,
  type BomVariantOption,
} from "../types/build-orders.types";

/** Map a ZodError's nested issues to dotted-path field errors. */
function zodFieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".");
    (out[path] ??= []).push(issue.message);
  }
  return out;
}

export function BuildOrderNewPage() {
  const navigate = useNavigate();
  const { data: warehouses } = useBuildWarehouseOptions();
  const create = useCreateBuildOrder();

  const [variant, setVariant] = useState<BomVariantOption | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [qtyPlanned, setQtyPlanned] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const whOptions = warehouses ?? [];
  // A variant chosen with no active BOM can't be built — surface a hint.
  const noBom = variant != null && !variant.hasActiveBom;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormErrors([]);

    const payload = {
      variantId: variant?.variantId ?? "",
      bomId: variant?.activeBomId ?? undefined,
      warehouseId,
      qtyPlanned: qtyPlanned.trim(),
      notes: notes.trim() || undefined,
    };

    const parsed = createBuildOrderSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    if (noBom) {
      setFieldErrors((e) => ({
        ...e,
        variantId: ["This variant has no active BOM and can't be built."],
      }));
      return;
    }

    try {
      const result = await create.mutateAsync(parsed.data);
      await navigate({
        to: "/build-orders/$buildOrderId",
        params: { buildOrderId: result.id },
      });
    } catch (err) {
      const mapped = unwrapFieldErrors(err);
      if (mapped) {
        setFieldErrors(mapped.fieldErrors);
        setFormErrors(mapped.formErrors);
      } else {
        setFormErrors(["Could not create the build order. Try again."]);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New Build"
        description="Open a build order to manufacture a variant from its bill of materials. Creates a draft you can then plan, start and complete."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/build-orders">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Link>
          </Button>
        }
      />

      <form className="flex max-w-2xl flex-col gap-6" onSubmit={onSubmit}>
        {formErrors.length > 0 ? (
          <div className="border-2 border-soldout bg-soldout/10 px-4 py-3">
            {formErrors.map((m, i) => (
              <p key={i} className="font-mono text-[0.8125rem] text-soldout">
                {m}
              </p>
            ))}
          </div>
        ) : null}

        {/* Output variant */}
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Output variant</span>
          <VariantPicker
            value={variant}
            onPick={setVariant}
            invalid={Boolean(errorFor(fieldErrors, "variantId")) || noBom}
            aria-label="Output variant"
          />
          {noBom ? (
            <p className="flex items-center gap-1.5 font-mono text-[0.6875rem] leading-snug text-soldout">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              This variant has no active BOM. Pick one with a BOM to build it.
            </p>
          ) : (
            <FieldError message={errorFor(fieldErrors, "variantId")} />
          )}
          {variant && !noBom ? (
            <p className="font-mono text-[0.6875rem] text-smoke">
              Building from BOM {variant.activeBomId ? "" : "(latest) "}·{" "}
              {variant.versionCount === 1
                ? "1 version"
                : `${variant.versionCount} versions`}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Build warehouse"
            path="warehouseId"
            errors={fieldErrors}
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">Select warehouse…</option>
            {whOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </SelectField>

          <TextField
            label="Planned quantity"
            path="qtyPlanned"
            errors={fieldErrors}
            inputMode="decimal"
            placeholder="e.g. 100"
            value={qtyPlanned}
            onChange={(e) => setQtyPlanned(e.target.value)}
          />
        </div>

        <TextAreaField
          label="Notes"
          path="notes"
          errors={fieldErrors}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional — run notes, reference, handling instructions…"
        />

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={create.isPending}
          >
            {create.isPending ? "Creating…" : "Create build order"}
          </Button>
          <Button asChild variant="ghost" size="md">
            <Link to="/build-orders">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
