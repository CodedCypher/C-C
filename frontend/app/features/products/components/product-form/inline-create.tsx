/**
 * circuit.rocks — products feature: inline brand/category creator.
 *
 * A small disclosure that creates a brand/category via the feature's mutation
 * hooks, then calls `onCreated` with the freshly parsed option so the parent can
 * append + select it. Replaces the old `useFetcher`-to-route-action approach:
 * the mutation hits `POST /products/brands|categories` directly through axios,
 * and 400/409 validation errors are surfaced inline via `unwrapFieldErrors`.
 */

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { unwrapFieldErrors } from "~/lib/axios";
import { useCreateBrand } from "../../hooks/use-create-brand";
import { useCreateCategory } from "../../hooks/use-create-category";
import type { BrandOption, CategoryOption } from "../../types/products.types";
import { controlClass, labelClass } from "./fields";

type Created = BrandOption | CategoryOption;

/** First form-level message from an axios error, or a generic fallback. */
function firstError(error: unknown): string {
  const unwrapped = unwrapFieldErrors(error);
  if (unwrapped) {
    if (unwrapped.formErrors.length > 0) return unwrapped.formErrors[0];
    const firstField = Object.values(unwrapped.fieldErrors)[0];
    if (firstField && firstField.length > 0) return firstField[0];
  }
  return "Could not create. Please try again.";
}

export function InlineCreate({
  kind,
  onCreated,
}: {
  kind: "brand" | "category";
  /** Called once with the freshly created option (parent appends + selects). */
  onCreated: (opt: Created) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createBrand = useCreateBrand();
  const createCategory = useCreateCategory();
  const busy = createBrand.isPending || createCategory.isPending;

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const created =
        kind === "brand"
          ? await createBrand.mutateAsync({ name: trimmed })
          : await createCategory.mutateAsync({ name: trimmed });
      onCreated(created);
      setName("");
      setOpen(false);
    } catch (err) {
      setError(firstError(err));
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[0.75rem] font-bold uppercase tracking-[0.06em] text-ink underline-offset-2 hover:underline"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        New {kind}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-2 border-line bg-paper-2 p-3">
      <div className="flex items-center justify-between">
        <span className={labelClass}>New {kind}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={`Cancel new ${kind}`}
          className="text-smoke hover:text-ink"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-stretch gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${kind === "brand" ? "Brand" : "Category"} name`}
          aria-label={`New ${kind} name`}
          className={controlClass}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={busy || name.trim() === ""}
          onClick={() => void submit()}
        >
          {busy ? "Adding…" : "Add"}
        </Button>
      </div>
      {error ? (
        <p className="font-mono text-[0.6875rem] text-soldout">{error}</p>
      ) : null}
    </div>
  );
}
