/**
 * circuit.rocks — warehouses feature: create/edit form Sheet.
 *
 * One right-side Sheet (NOT a modal) that drives both create and edit:
 *   - `mode="create"` POSTs /warehouses, then calls `onCreated(id)`
 *   - `mode="edit"` PATCHes /warehouses/:id with the full field set
 *
 * The form holds local `useState` and seeds from `initial` when it (re)opens.
 * On submit it maps any backend 400/409 via `unwrapFieldErrors` back onto the
 * controls (dotted paths like `code`) and the form-error banner. Codes / names /
 * addresses are plain strings; blank optional fields are sent as `null` on edit
 * (to clear) and omitted on create.
 */

import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { unwrapFieldErrors } from "~/lib/axios";

import { useCreateWarehouse, useUpdateWarehouse } from "../hooks/use-warehouses";
import {
  WAREHOUSE_TYPES,
  warehouseTypeLabel,
  type WarehouseDetail,
} from "../types/warehouses.types";
import {
  CheckboxField,
  FormErrors,
  SelectField,
  TextField,
  type FieldErrors,
} from "./fields";

/** Mutable form state — every value is a string/boolean for controlled inputs. */
interface FormState {
  name: string;
  code: string;
  type: string;
  isDefaultWeb: boolean;
  isActive: boolean;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
}

const EMPTY: FormState = {
  name: "",
  code: "",
  type: "GENERAL",
  isDefaultWeb: false,
  isActive: true,
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  phone: "",
};

function seedFrom(detail: WarehouseDetail): FormState {
  return {
    name: detail.name,
    code: detail.code,
    type: detail.type,
    isDefaultWeb: detail.isDefaultWeb,
    isActive: detail.isActive,
    line1: detail.line1 ?? "",
    line2: detail.line2 ?? "",
    city: detail.city ?? "",
    region: detail.region ?? "",
    postalCode: detail.postalCode ?? "",
    country: detail.country ?? "",
    phone: detail.phone ?? "",
  };
}

/** "" → undefined (create: omit). */
function opt(s: string): string | undefined {
  const t = s.trim();
  return t === "" ? undefined : t;
}

/** "" → null (edit: clear). */
function nullable(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

export function WarehouseFormSheet({
  open,
  onOpenChange,
  mode,
  initial,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Required in edit mode — the warehouse being edited. */
  initial?: WarehouseDetail;
  /** Called with the new warehouse id after a successful create. */
  onCreated?: (id: string) => void;
}) {
  const create = useCreateWarehouse();
  const update = useUpdateWarehouse(initial?.id ?? "");

  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Seed whenever the sheet (re)opens.
  useEffect(() => {
    if (!open) return;
    setForm(mode === "edit" && initial ? seedFrom(initial) : EMPTY);
    setFieldErrors({});
    setFormErrors([]);
  }, [open, mode, initial]);

  const pending = create.isPending || update.isPending;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormErrors([]);

    // Light client-side guard (the backend is the source of truth).
    const localErrors: FieldErrors = {};
    if (form.name.trim() === "") localErrors.name = ["Name is required."];
    if (form.code.trim() === "") localErrors.code = ["Code is required."];
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      return;
    }

    try {
      if (mode === "create") {
        const result = await create.mutateAsync({
          name: form.name.trim(),
          code: form.code.trim(),
          type: form.type,
          isDefaultWeb: form.isDefaultWeb,
          line1: opt(form.line1),
          line2: opt(form.line2),
          city: opt(form.city),
          region: opt(form.region),
          postalCode: opt(form.postalCode),
          country: opt(form.country),
          phone: opt(form.phone),
        });
        onOpenChange(false);
        onCreated?.(result.id);
      } else {
        // Code is immutable on edit — never send it in the PATCH body.
        await update.mutateAsync({
          name: form.name.trim(),
          type: form.type,
          isDefaultWeb: form.isDefaultWeb,
          isActive: form.isActive,
          line1: nullable(form.line1),
          line2: nullable(form.line2),
          city: nullable(form.city),
          region: nullable(form.region),
          postalCode: nullable(form.postalCode),
          country: nullable(form.country),
          phone: nullable(form.phone),
        });
        onOpenChange(false);
      }
    } catch (err) {
      const mapped = unwrapFieldErrors(err);
      if (mapped) {
        setFieldErrors(mapped.fieldErrors);
        setFormErrors(
          mapped.formErrors.length > 0
            ? mapped.formErrors
            : ["Could not save. Review the values and try again."],
        );
      } else {
        setFormErrors(["Could not save the warehouse. Please try again."]);
      }
    }
  }

  const formId = "warehouse-form";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {mode === "create" ? "New warehouse" : "Edit warehouse"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Add a stock location. The web-default warehouse fulfils online orders."
              : "Update this warehouse's details, type, default and active status."}
          </SheetDescription>
        </SheetHeader>

        <form
          id={formId}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-6"
          onSubmit={handleSubmit}
        >
          <FormErrors errors={formErrors} />

          <TextField
            label="Name"
            path="name"
            errors={fieldErrors}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Manila Distribution"
            autoComplete="off"
          />

          <TextField
            label="Code"
            path="code"
            errors={fieldErrors}
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder="e.g. MNL-DC"
            autoComplete="off"
            readOnly={mode === "edit"}
            disabled={mode === "edit"}
            hint={
              mode === "edit"
                ? "Code is fixed once a warehouse is created."
                : undefined
            }
          />

          <SelectField
            label="Type"
            path="type"
            errors={fieldErrors}
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
          >
            {WAREHOUSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {warehouseTypeLabel(t)}
              </option>
            ))}
          </SelectField>

          <div className="flex flex-col gap-3 border-2 border-line bg-paper-2 p-3 shadow-press">
            <CheckboxField
              label="Web default warehouse"
              path="isDefaultWeb"
              errors={fieldErrors}
              checked={form.isDefaultWeb}
              onChange={(e) => set("isDefaultWeb", e.target.checked)}
              hint="Fulfils online orders. Only one warehouse can be the web default."
            />
            {mode === "edit" ? (
              <CheckboxField
                label="Active"
                path="isActive"
                errors={fieldErrors}
                checked={form.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                hint="Inactive warehouses are hidden from new stock operations."
              />
            ) : null}
          </div>

          <fieldset className="flex flex-col gap-4 border-2 border-line p-3">
            <legend className="px-1 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke">
              Address (optional)
            </legend>

            <TextField
              label="Line 1"
              path="line1"
              errors={fieldErrors}
              value={form.line1}
              onChange={(e) => set("line1", e.target.value)}
              autoComplete="off"
            />
            <TextField
              label="Line 2"
              path="line2"
              errors={fieldErrors}
              value={form.line2}
              onChange={(e) => set("line2", e.target.value)}
              autoComplete="off"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="City"
                path="city"
                errors={fieldErrors}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                autoComplete="off"
              />
              <TextField
                label="Region"
                path="region"
                errors={fieldErrors}
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Postal code"
                path="postalCode"
                errors={fieldErrors}
                value={form.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
                autoComplete="off"
              />
              <TextField
                label="Country"
                path="country"
                errors={fieldErrors}
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                autoComplete="off"
              />
            </div>
            <TextField
              label="Phone"
              path="phone"
              errors={fieldErrors}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              autoComplete="off"
            />
          </fieldset>
        </form>

        <SheetFooter className="flex-row justify-end gap-2 border-t-2 border-line">
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            size="sm"
            disabled={pending}
          >
            {pending
              ? "Saving…"
              : mode === "create"
                ? "Create warehouse"
                : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
