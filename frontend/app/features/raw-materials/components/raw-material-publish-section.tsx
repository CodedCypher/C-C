/**
 * circuit.rocks — raw-materials: "publish as product" section for the detail Sheet.
 *
 * A raw material isn't sellable on its own (it has no price and the cart only
 * holds Variants). This spins up a sellable Product + Variant from the material
 * — with its OWN web-stock pool, separate from build inventory — so the
 * storefront build chat can match and sell it. Once published, the material
 * just links out to the live product.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, PackagePlus } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { unwrapFieldErrors } from "~/lib/axios";
import { TextField, type FieldErrors } from "./fields";
import { usePublishRawMaterial } from "../hooks/use-publish-raw-material";
import type { RawMaterialDetail } from "../types/raw-materials.types";

export function RawMaterialPublishSection({
  material,
}: {
  material: RawMaterialDetail;
}) {
  const publish = usePublishRawMaterial();
  const [open, setOpen] = useState(false);
  // Suggest a price at 2× the planning cost; admin sets the final number.
  const [price, setPrice] = useState(
    material.standardCost != null
      ? (Math.round(material.standardCost * 2 * 100) / 100).toFixed(2)
      : "",
  );
  const [initialStock, setInitialStock] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Already published → link to the live storefront product.
  if (material.published) {
    return (
      <div className="flex items-center justify-between gap-3 border-2 border-line bg-paper-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="stock" size="sm">
            Published
          </Badge>
          <span className="font-mono text-[0.75rem] text-smoke">
            Sold as a product
          </span>
        </div>
        <Link
          to="/products/$slug"
          params={{ slug: material.published.slug }}
          className="inline-flex items-center gap-1 font-mono text-[0.75rem] text-signal hover:underline"
        >
          View product
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="md"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        <PackagePlus className="size-4" aria-hidden="true" />
        Publish as product
      </Button>
    );
  }

  async function submit() {
    setErrors({});
    setFormError(null);
    try {
      await publish.mutateAsync({
        id: material.id,
        body: {
          price: price.trim(),
          initialStock: initialStock.trim() || undefined,
        },
      });
      // The hook invalidates this material's detail → repaints into "Published".
      setOpen(false);
    } catch (err) {
      const unwrapped = unwrapFieldErrors(err);
      setErrors(unwrapped?.fieldErrors ?? {});
      setFormError(
        unwrapped?.formErrors?.[0] ?? "Could not publish this material.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-3 border-2 border-line bg-paper-2 p-3">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
        Publish as a sellable product
      </p>
      {formError ? (
        <p className="font-mono text-[0.6875rem] leading-snug text-soldout">
          {formError}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Price (₱)"
          path="price"
          errors={errors}
          inputMode="decimal"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <TextField
          label="Initial web stock"
          path="initialStock"
          errors={errors}
          inputMode="numeric"
          placeholder="0"
          value={initialStock}
          onChange={(e) => setInitialStock(e.target.value)}
        />
      </div>
      <p className="font-mono text-[0.6875rem] leading-snug text-smoke">
        Gets its own stock pool — separate from this material's build inventory.
      </p>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={publish.isPending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={publish.isPending || price.trim().length === 0}
          onClick={submit}
        >
          {publish.isPending ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}
