import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Boxes, Plus, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { unwrapFieldErrors } from "~/lib/axios";
import { peso2 } from "~/lib/format";
import {
  useCreateProjectKit,
  useUpdateProjectKit,
} from "../hooks/use-project-kits";
import {
  createProjectKitSchema,
  type KitPartOption,
  type ProjectKitDetail,
} from "../types/project-kits.types";
import {
  FieldError,
  FormErrors,
  TextField,
  TextareaField,
  errorFor,
  labelClass,
  type FieldErrors,
} from "./fields";
import { KitPartPicker } from "./kit-part-picker";

interface PartRow {
  stockItemId: string;
  name: string;
  sku: string;
  uom: string;
  quantity: string;
  unitPrice: number | null; // sale price if known (null = added before resolve)
}

function zodToFieldErrors(err: z.ZodError): FieldErrors {
  const fe: FieldErrors = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".");
    (fe[path] ??= []).push(issue.message);
  }
  return fe;
}

export function KitForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: ProjectKitDetail;
}) {
  const navigate = useNavigate();
  const createMut = useCreateProjectKit();
  const updateMut = useUpdateProjectKit();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.primaryImage ?? "");
  const [kitPrice, setKitPrice] = useState(
    initial ? String(initial.kitPrice) : "",
  );
  const [parts, setParts] = useState<PartRow[]>(
    initial
      ? initial.parts.map((p) => ({
          stockItemId: p.stockItemId,
          name: p.name,
          sku: p.sku,
          uom: p.uom,
          quantity: String(p.quantity),
          unitPrice: p.unitPrice,
        }))
      : [],
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const pending = createMut.isPending || updateMut.isPending;

  const allPriced = parts.length > 0 && parts.every((p) => p.unitPrice != null);
  const knownTotal = parts.reduce(
    (sum, p) =>
      p.unitPrice != null ? sum + p.unitPrice * (Number(p.quantity) || 0) : sum,
    0,
  );

  function addPart(opt: KitPartOption) {
    setParts((prev) =>
      prev.some((p) => p.stockItemId === opt.stockItemId)
        ? prev
        : [
            ...prev,
            {
              stockItemId: opt.stockItemId,
              name: opt.name,
              sku: opt.sku,
              uom: opt.uom,
              quantity: "1",
              unitPrice: opt.price,
            },
          ],
    );
  }

  function setQty(idx: number, quantity: string) {
    setParts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, quantity } : p)),
    );
  }

  function removePart(idx: number) {
    setParts((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleError(err: unknown) {
    const unwrapped = unwrapFieldErrors(err);
    if (unwrapped) {
      setFieldErrors(unwrapped.fieldErrors);
      setFormErrors(unwrapped.formErrors);
    } else {
      setFormErrors(["Something went wrong. Please try again."]);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormErrors([]);

    const payload = {
      title: title.trim(),
      kitPrice: kitPrice.trim(),
      parts: parts.map((p) => ({
        stockItemId: p.stockItemId,
        quantity: p.quantity.trim() || "0",
      })),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
    };

    const parsed = createProjectKitSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodToFieldErrors(parsed.error));
      return;
    }

    if (mode === "create") {
      createMut.mutate(parsed.data, {
        onSuccess: (r) =>
          navigate({ to: "/project-kits/$kitId", params: { kitId: r.id } }),
        onError: handleError,
      });
    } else if (initial) {
      updateMut.mutate(
        {
          id: initial.id,
          body: {
            title: payload.title,
            description: description.trim() ? description.trim() : null,
            imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
            kitPrice: payload.kitPrice,
            parts: parsed.data.parts,
          },
        },
        {
          onSuccess: () => navigate({ to: "/project-kits" }),
          onError: handleError,
        },
      );
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <FormErrors errors={formErrors} />

      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          label="Kit title"
          path="title"
          errors={fieldErrors}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Weather Station Starter Kit"
          className="md:col-span-2"
        />
        <TextField
          label="Hero image URL"
          path="imageUrl"
          errors={fieldErrors}
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="/products/rpi5.jpg or https://…"
          hint="Absolute http(s) or root-relative path."
        />
        <TextField
          label="Kit price (assembled)"
          path="kitPrice"
          errors={fieldErrors}
          inputMode="decimal"
          value={kitPrice}
          onChange={(e) => setKitPrice(e.target.value)}
          placeholder="4990.00"
          hint={
            allPriced
              ? `Parts total is ${peso2(knownTotal)}.`
              : "Shown as the assembled price on the kit page."
          }
        />
      </div>

      <TextareaField
        label="Description"
        path="description"
        errors={fieldErrors}
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What the kit builds and what's included."
      />

      {/* ── Parts ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className={labelClass}>Parts</span>
          {allPriced ? (
            <button
              type="button"
              onClick={() => setKitPrice(knownTotal.toFixed(2))}
              className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke underline-offset-2 hover:text-ink hover:underline"
            >
              Use parts total ({peso2(knownTotal)}) →
            </button>
          ) : null}
        </div>

        <KitPartPicker
          onPick={addPart}
          invalid={Boolean(errorFor(fieldErrors, "parts"))}
        />
        <FieldError message={errorFor(fieldErrors, "parts")} />

        {parts.length === 0 ? (
          <div className="flex items-center gap-2 border-2 border-dashed border-line px-3 py-6 font-mono text-[0.75rem] text-smoke">
            <Boxes className="size-4" aria-hidden="true" />
            No parts yet. Search above to add catalog products.
          </div>
        ) : (
          <ul className="flex flex-col border-2 border-line">
            {parts.map((p, i) => {
              const qtyErr = errorFor(fieldErrors, `parts.${i}.quantity`);
              const idErr = errorFor(fieldErrors, `parts.${i}.stockItemId`);
              return (
                <li
                  key={p.stockItemId}
                  className="flex items-center gap-3 border-b-2 border-line px-3 py-2.5 last:border-b-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[0.8125rem] text-ink">
                      {p.name}
                    </span>
                    <span className="truncate font-mono text-[0.6875rem] text-smoke">
                      {p.sku}
                      {p.unitPrice != null ? ` · ${peso2(p.unitPrice)}` : ""}
                    </span>
                    <FieldError message={idErr} />
                  </span>
                  <label className="flex flex-col gap-1">
                    <input
                      aria-label={`Quantity for ${p.name}`}
                      inputMode="decimal"
                      value={p.quantity}
                      onChange={(e) => setQty(i, e.target.value)}
                      className="w-20 border-2 border-line bg-paper px-2 py-1.5 text-right font-mono text-[0.8125rem] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    />
                    <FieldError message={qtyErr} />
                  </label>
                  <span className="w-10 font-mono text-[0.6875rem] uppercase text-smoke">
                    {p.uom}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => removePart(i)}
                    className="text-smoke hover:text-soldout"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          <Plus className="size-4" aria-hidden="true" />
          {mode === "create" ? "Create kit" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => navigate({ to: "/project-kits" })}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
