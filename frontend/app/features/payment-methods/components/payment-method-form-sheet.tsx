/**
 * circuit.rocks — payment-methods feature: create/edit form Sheet.
 *
 * One right-side Sheet driving both create (POST /payment-methods) and edit
 * (PATCH /payment-methods/:id). The QR image is managed in edit mode only (it
 * needs a saved method id to attach to) via the separate POST /:id/qr upload.
 * Backend 400s map via `unwrapFieldErrors` onto the controls + a form banner.
 */

import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { unwrapFieldErrors } from "~/lib/axios";

import {
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useUploadPaymentMethodQr,
} from "../hooks/use-payment-methods";
import type { PaymentMethod } from "../types/payment-methods.types";
import {
  CheckboxField,
  FormErrors,
  TextField,
  TextareaField,
  type FieldErrors,
} from "./fields";

/** Backend static-file origin (QR images served under /uploads on the API host). */
const FILE_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface FormState {
  name: string;
  instructions: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY: FormState = {
  name: "",
  instructions: "",
  isActive: true,
  sortOrder: "0",
};

function seedFrom(m: PaymentMethod): FormState {
  return {
    name: m.name,
    instructions: m.instructions ?? "",
    isActive: m.isActive,
    sortOrder: String(m.sortOrder),
  };
}

export function PaymentMethodFormSheet({
  open,
  onOpenChange,
  mode,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Required in edit mode — the method being edited. */
  initial?: PaymentMethod;
}) {
  const create = useCreatePaymentMethod();
  const update = useUpdatePaymentMethod(initial?.id ?? "");
  const uploadQr = useUploadPaymentMethodQr(initial?.id ?? "");

  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(mode === "edit" && initial ? seedFrom(initial) : EMPTY);
    setQrUrl(initial?.qrImageUrl ?? null);
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

    if (form.name.trim() === "") {
      setFieldErrors({ name: ["Name is required."] });
      return;
    }

    const body = {
      name: form.name.trim(),
      instructions: form.instructions.trim() || undefined,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };

    try {
      if (mode === "create") {
        await create.mutateAsync(body);
      } else {
        await update.mutateAsync(body);
      }
      onOpenChange(false);
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
        setFormErrors(["Could not save the payment method. Please try again."]);
      }
    }
  }

  async function handleQr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !initial) return;
    setFormErrors([]);
    try {
      const updated = await uploadQr.mutateAsync(file);
      setQrUrl(updated.qrImageUrl);
    } catch (err) {
      const mapped = unwrapFieldErrors(err);
      setFormErrors(
        mapped?.fieldErrors.file ??
          mapped?.formErrors ?? ["Could not upload the QR image."],
      );
    }
  }

  const formId = "payment-method-form";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {mode === "create" ? "New payment method" : "Edit payment method"}
          </SheetTitle>
          <SheetDescription>
            Shown to shoppers at checkout. Inactive methods are hidden.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-1 py-4">
          <form
            id={formId}
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            <FormErrors errors={formErrors} />

            <TextField
              label="Name"
              path="name"
              errors={fieldErrors}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. GCash, BPI Transfer"
            />

            <TextareaField
              label="Instructions"
              path="instructions"
              errors={fieldErrors}
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder="Account name / number / notes shown to the buyer"
            />

            <TextField
              label="Sort order"
              type="number"
              path="sortOrder"
              errors={fieldErrors}
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", e.target.value)}
              hint="Lower shows first at checkout."
            />

            <CheckboxField
              label="Active"
              path="isActive"
              errors={fieldErrors}
              checked={form.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
          </form>

          {/* QR image — edit mode only (needs a saved method to attach to). */}
          <div className="mt-6 flex flex-col gap-2 border-t-2 border-line pt-4">
            <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke">
              QR image (optional)
            </span>
            {mode === "create" ? (
              <p className="font-mono text-[0.6875rem] text-smoke">
                Save the method first, then re-open it to upload a QR image.
              </p>
            ) : (
              <>
                {qrUrl ? (
                  <img
                    src={`${FILE_BASE}${qrUrl}`}
                    alt="Payment QR"
                    className="h-40 w-40 border-2 border-line object-contain"
                  />
                ) : (
                  <p className="font-mono text-[0.6875rem] text-smoke">
                    No QR image uploaded.
                  </p>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleQr}
                  disabled={uploadQr.isPending}
                  className="font-mono text-[0.8125rem] text-ink file:mr-3 file:border-2 file:border-line file:bg-paper-2 file:px-3 file:py-1.5 file:font-mono file:text-[0.75rem] file:text-ink"
                />
                {uploadQr.isPending ? (
                  <span className="font-mono text-[0.6875rem] text-smoke">
                    Uploading…
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            form={formId}
            type="submit"
            variant="primary"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
