/**
 * circuit.rocks — branches feature: create/edit form Sheet.
 *
 * One right-side Sheet (NOT a modal) that drives both create and edit:
 *   - `mode="create"` POSTs /branches, then calls `onCreated(id)`
 *   - `mode="edit"` PATCHes /branches/:id (incl `isActive`)
 *
 * The form holds local `useState` and seeds from `initial` when it (re)opens.
 * On submit it maps any backend 400/409 via `unwrapFieldErrors` back onto the
 * controls (dotted paths like `code`) and the form-error banner. Codes / names /
 * addresses / email are plain strings; blank optional fields are sent as `null`
 * on edit (to clear) and omitted on create. Code is fixed once created.
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

import { useCreateBranch, useUpdateBranch } from "../hooks/use-branches";
import type { BranchDetail } from "../types/branches.types";
import {
  CheckboxField,
  FormErrors,
  TextField,
  type FieldErrors,
} from "./fields";

/** Mutable form state — every value is a string/boolean for controlled inputs. */
interface FormState {
  name: string;
  code: string;
  email: string;
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
  email: "",
  isActive: true,
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  phone: "",
};

function seedFrom(detail: BranchDetail): FormState {
  return {
    name: detail.name,
    code: detail.code,
    email: detail.email ?? "",
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

export function BranchFormSheet({
  open,
  onOpenChange,
  mode,
  initial,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Required in edit mode — the branch being edited. */
  initial?: BranchDetail;
  /** Called with the new branch id after a successful create. */
  onCreated?: (id: string) => void;
}) {
  const create = useCreateBranch();
  const update = useUpdateBranch(initial?.id ?? "");

  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

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
          email: opt(form.email),
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
          isActive: form.isActive,
          email: nullable(form.email),
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
        setFormErrors(["Could not save the branch. Please try again."]);
      }
    }
  }

  const formId = "branch-form";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {mode === "create" ? "New branch" : "Edit branch"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Add a physical store location for walk-in pickup and over-the-counter sales."
              : "Update this branch's details and active status."}
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
            placeholder="e.g. Cebu Downtown"
            autoComplete="off"
          />

          <TextField
            label="Code"
            path="code"
            errors={fieldErrors}
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder="e.g. CEB-DT"
            autoComplete="off"
            readOnly={mode === "edit"}
            disabled={mode === "edit"}
            hint={
              mode === "edit"
                ? "Code is fixed once a branch is created."
                : undefined
            }
          />

          <TextField
            label="Email"
            path="email"
            errors={fieldErrors}
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="store@circuit.rocks"
            autoComplete="off"
          />

          {mode === "edit" ? (
            <div className="border-2 border-line bg-paper-2 p-3 shadow-press">
              <CheckboxField
                label="Active"
                path="isActive"
                errors={fieldErrors}
                checked={form.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                hint="Inactive branches are hidden from new sales operations."
              />
            </div>
          ) : null}

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
                ? "Create branch"
                : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
