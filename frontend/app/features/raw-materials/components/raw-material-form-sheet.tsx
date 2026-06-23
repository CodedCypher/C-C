/**
 * circuit.rocks — raw-materials feature: create/edit form Sheet.
 *
 * A right-side Sheet (NOT a modal) hosting the material form. One component
 * serves both modes:
 *   - CREATE: empty form + an optional initial-stock rows builder (warehouse
 *     select + qty). POSTs and returns the created summary.
 *   - EDIT: pre-filled from the detail; SKU is read-only; no initial-stock
 *     builder. PATCHes a partial body.
 *
 * NO react-hook-form — local `useState`. Quantities/costs are STRINGS end to
 * end; `buildXxxPayload` strips blanks (omit, never send ""). On submit we
 * `mutateAsync` then `catch` → `unwrapFieldErrors(error)` → render fieldErrors
 * inline + formErrors at the top. Closing the Sheet resets the form.
 */

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { unwrapFieldErrors } from "~/lib/axios";
import { cn } from "~/lib/utils";
import { useCreateRawMaterial } from "../hooks/use-create-raw-material";
import { useUpdateRawMaterial } from "../hooks/use-update-raw-material";
import { useWarehouseOptions } from "../hooks/use-warehouse-options";
import {
  UNITS_OF_MEASURE,
  type CreateRawMaterialInput,
  type RawMaterialDetail,
  type UnitOfMeasure,
  type UpdateRawMaterialInput,
} from "../types/raw-materials.types";
import {
  CellInput,
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
  errorFor,
  labelClass,
  type FieldErrors,
} from "./fields";

/* ------------------------------------------------------------------ *
 * Local form state (all STRINGS; checkboxes booleans)
 * ------------------------------------------------------------------ */

interface StockRow {
  warehouseId: string;
  onHand: string;
}

interface FormState {
  name: string;
  sku: string;
  description: string;
  defaultUnit: UnitOfMeasure;
  standardCost: string;
  reorderPoint: string;
  reorderQty: string;
  safetyStock: string;
  trackLot: boolean;
  trackSerial: boolean;
  initialStock: StockRow[];
}

function emptyState(): FormState {
  return {
    name: "",
    sku: "",
    description: "",
    defaultUnit: "EACH",
    standardCost: "",
    reorderPoint: "",
    reorderQty: "",
    safetyStock: "",
    trackLot: false,
    trackSerial: false,
    initialStock: [],
  };
}

/** Pre-fill the form from an existing material detail (edit mode). */
function stateFromDetail(d: RawMaterialDetail): FormState {
  const num = (n: number | null): string => (n == null ? "" : String(n));
  return {
    name: d.name,
    sku: d.sku,
    description: d.description ?? "",
    defaultUnit: (UNITS_OF_MEASURE as readonly string[]).includes(d.defaultUnit)
      ? (d.defaultUnit as UnitOfMeasure)
      : "EACH",
    standardCost: num(d.standardCost),
    reorderPoint: num(d.reorderPoint),
    reorderQty: num(d.reorderQty),
    safetyStock: num(d.safetyStock),
    trackLot: d.trackLot,
    trackSerial: d.trackSerial,
    initialStock: [],
  };
}

/** Trim a string; return undefined when empty (omit, never send ""). */
function opt(value: string): string | undefined {
  const v = value.trim();
  return v === "" ? undefined : v;
}

/** Serialise the form to the EXACT POST /raw-materials body. */
function buildCreatePayload(s: FormState): CreateRawMaterialInput {
  const initialStock = s.initialStock
    .map((row) => ({
      warehouseId: row.warehouseId,
      onHand: row.onHand.trim(),
    }))
    .filter((row) => row.warehouseId !== "" && row.onHand !== "");

  return {
    name: s.name.trim(),
    sku: s.sku.trim(),
    description: opt(s.description),
    defaultUnit: s.defaultUnit,
    standardCost: opt(s.standardCost),
    reorderPoint: opt(s.reorderPoint),
    reorderQty: opt(s.reorderQty),
    safetyStock: opt(s.safetyStock),
    trackLot: s.trackLot,
    trackSerial: s.trackSerial,
    ...(initialStock.length > 0 ? { initialStock } : {}),
  };
}

/**
 * Serialise the form to a PATCH /raw-materials/:id body. `standardCost` may be
 * cleared (sent as null) when the field is emptied; the other money fields are
 * omitted when blank.
 */
function buildUpdatePayload(s: FormState): UpdateRawMaterialInput {
  return {
    name: s.name.trim(),
    description: opt(s.description),
    defaultUnit: s.defaultUnit,
    standardCost: s.standardCost.trim() === "" ? null : s.standardCost.trim(),
    reorderPoint: opt(s.reorderPoint),
    reorderQty: opt(s.reorderQty),
    safetyStock: opt(s.safetyStock),
    trackLot: s.trackLot,
    trackSerial: s.trackSerial,
  };
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export interface RawMaterialFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the Sheet edits this material; otherwise it creates a new one. */
  material?: RawMaterialDetail | null;
  /** Called after a successful create/update (e.g. to close + toast). */
  onSaved?: (id: string) => void;
}

const moneyControl = "max-w-[10rem]";

export function RawMaterialFormSheet({
  open,
  onOpenChange,
  material,
  onSaved,
}: RawMaterialFormSheetProps) {
  const isEdit = material != null;
  const [state, setState] = useState<FormState>(emptyState);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const { data: warehouses } = useWarehouseOptions();
  const createMaterial = useCreateRawMaterial();
  const updateMaterial = useUpdateRawMaterial();
  const submitting = createMaterial.isPending || updateMaterial.isPending;

  // Re-seed the form whenever the Sheet opens (or the target material changes).
  useEffect(() => {
    if (!open) return;
    setState(material ? stateFromDetail(material) : emptyState());
    setFieldErrors({});
    setFormErrors([]);
  }, [open, material]);

  function patch(partial: Partial<FormState>) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  function addStockRow() {
    patch({
      initialStock: [...state.initialStock, { warehouseId: "", onHand: "" }],
    });
  }

  function patchStockRow(index: number, partial: Partial<StockRow>) {
    patch({
      initialStock: state.initialStock.map((row, i) =>
        i === index ? { ...row, ...partial } : row,
      ),
    });
  }

  function removeStockRow(index: number) {
    patch({
      initialStock: state.initialStock.filter((_, i) => i !== index),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormErrors([]);

    try {
      if (isEdit && material) {
        await updateMaterial.mutateAsync({
          id: material.id,
          body: buildUpdatePayload(state),
        });
        onSaved?.(material.id);
      } else {
        const created = await createMaterial.mutateAsync(
          buildCreatePayload(state),
        );
        onSaved?.(created.id);
      }
      onOpenChange(false);
    } catch (err) {
      const unwrapped = unwrapFieldErrors(err);
      if (unwrapped) {
        setFieldErrors(unwrapped.fieldErrors);
        setFormErrors(unwrapped.formErrors);
      } else {
        setFormErrors([
          isEdit
            ? "Could not save changes. Please try again."
            : "Could not create material. Please try again.",
        ]);
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit material" : "New material"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this raw material's details and stock policy."
              : "Add a raw material with its unit, cost and stock policy."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            {formErrors.length > 0 ? (
              <div className="flex flex-col gap-1.5 border-2 border-soldout bg-paper px-4 py-3">
                <p className="cr-mono text-soldout">// could not save</p>
                <ul className="flex flex-col gap-1">
                  {formErrors.map((er, i) => (
                    <li
                      key={i}
                      className="font-mono text-[0.8125rem] leading-snug text-soldout"
                    >
                      {er}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <TextField
              label="Name"
              path="name"
              errors={fieldErrors}
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="0.25mm copper wire"
              autoComplete="off"
            />

            {isEdit ? (
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>SKU</span>
                <div className="border-2 border-line bg-paper-2 px-3 py-2.5 font-mono text-[0.8125rem] text-smoke">
                  {state.sku}
                </div>
                <span className="font-mono text-[0.6875rem] text-smoke">
                  SKU is fixed after creation.
                </span>
              </div>
            ) : (
              <TextField
                label="SKU"
                path="sku"
                errors={fieldErrors}
                value={state.sku}
                onChange={(e) => patch({ sku: e.target.value })}
                placeholder="RAW-CU-025"
                autoComplete="off"
              />
            )}

            <TextAreaField
              label="Description"
              path="description"
              errors={fieldErrors}
              value={state.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Optional notes about this material…"
            />

            <SelectField
              label="Default unit"
              path="defaultUnit"
              errors={fieldErrors}
              value={state.defaultUnit}
              onChange={(e) =>
                patch({ defaultUnit: e.target.value as UnitOfMeasure })
              }
              className="max-w-[14rem]"
            >
              {UNITS_OF_MEASURE.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </SelectField>

            <TextField
              label="Standard cost (₱)"
              path="standardCost"
              errors={fieldErrors}
              inputMode="decimal"
              value={state.standardCost}
              onChange={(e) => patch({ standardCost: e.target.value })}
              placeholder="0.00"
              className={moneyControl}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField
                label="Reorder point"
                path="reorderPoint"
                errors={fieldErrors}
                inputMode="decimal"
                value={state.reorderPoint}
                onChange={(e) => patch({ reorderPoint: e.target.value })}
                placeholder="0"
              />
              <TextField
                label="Reorder qty"
                path="reorderQty"
                errors={fieldErrors}
                inputMode="decimal"
                value={state.reorderQty}
                onChange={(e) => patch({ reorderQty: e.target.value })}
                placeholder="0"
              />
              <TextField
                label="Safety stock"
                path="safetyStock"
                errors={fieldErrors}
                inputMode="decimal"
                value={state.safetyStock}
                onChange={(e) => patch({ safetyStock: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CheckboxField
                label="Track lots"
                hint="Record lot/batch numbers on receipt."
                checked={state.trackLot}
                onChange={(v) => patch({ trackLot: v })}
              />
              <CheckboxField
                label="Track serials"
                hint="Record a serial per unit."
                checked={state.trackSerial}
                onChange={(v) => patch({ trackSerial: v })}
              />
            </div>

            {/* ── Initial stock builder (create only) ── */}
            {!isEdit ? (
              <div className="flex flex-col gap-3 border-2 border-line bg-paper-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={labelClass}>Initial stock (optional)</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addStockRow}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add row
                  </Button>
                </div>

                {state.initialStock.length === 0 ? (
                  <p className="font-mono text-[0.75rem] leading-snug text-smoke">
                    No opening balance. Add a row to seed on-hand quantity at a
                    warehouse, or leave empty to start at zero.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {state.initialStock.map((row, i) => (
                      <div
                        key={i}
                        className="flex flex-wrap items-end gap-2 sm:flex-nowrap"
                      >
                        <label className="flex flex-1 flex-col gap-1.5">
                          <span className={cn(labelClass, "sr-only")}>
                            Warehouse
                          </span>
                          <select
                            value={row.warehouseId}
                            onChange={(e) =>
                              patchStockRow(i, { warehouseId: e.target.value })
                            }
                            aria-label={`Warehouse for stock row ${i + 1}`}
                            className="w-full cursor-pointer border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.8125rem] text-ink shadow-press outline-none transition-colors duration-150 hover:border-ink focus-visible:ring-2 focus-visible:ring-ink motion-reduce:transition-none"
                          >
                            <option value="">Select warehouse…</option>
                            {(warehouses ?? []).map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} ({w.code})
                              </option>
                            ))}
                          </select>
                        </label>
                        <CellInput
                          inputMode="decimal"
                          value={row.onHand}
                          onChange={(e) =>
                            patchStockRow(i, { onHand: e.target.value })
                          }
                          placeholder="0"
                          aria-label={`On hand for stock row ${i + 1}`}
                          className="w-24 shadow-press"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStockRow(i)}
                          aria-label={`Remove stock row ${i + 1}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {errorFor(fieldErrors, "initialStock") ? (
                  <p className="font-mono text-[0.6875rem] text-soldout">
                    {errorFor(fieldErrors, "initialStock")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* ── Footer actions ── */}
          <div className="mt-auto flex items-center justify-end gap-3 border-t-2 border-line p-6">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={submitting}>
              {submitting
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create material"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
