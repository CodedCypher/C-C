/**
 * circuit.rocks — storefront PDP (public route /products/$slug).
 *
 * Loads a single ACTIVE product via `useProduct(slug)` and renders the public
 * buy page: image gallery, title + brand, price, per-variant availability,
 * option-type pickers that resolve the matching variant, an "Add to cart"
 * action (opens the cart drawer), description and grouped specs.
 *
 * Variant resolution: each variant carries the option-value ids it maps to; the
 * selected value per option type resolves to the one variant matching all of
 * them. Products with no option types just use their single variant.
 */

import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Minus, Package, Plus } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { peso2 } from "~/lib/format";

import { useAddToCart, useProduct } from "../hooks/use-storefront";
import { useCartUI } from "../components/cart-context";
import {
  AVAILABILITY_META,
  type ProductDetail,
} from "../types/storefront.types";

const MAXW = "mx-auto max-w-[1320px]";

function Gallery({ images, title }: { images: ProductDetail["images"]; title: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex aspect-square items-center justify-center border-2 border-line bg-paper shadow-brutal">
        {current ? (
          <img
            src={current.url}
            alt={current.alt ?? title}
            className="size-full object-contain p-8 [mix-blend-mode:multiply]"
          />
        ) : (
          <Package className="size-16 text-smoke" aria-hidden="true" />
        )}
      </div>
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActive(i)}
              className={
                "flex size-16 items-center justify-center border-2 bg-paper " +
                (i === active ? "border-ink" : "border-line")
              }
            >
              <img
                src={img.url}
                alt=""
                className="size-full object-contain p-1.5 [mix-blend-mode:multiply]"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductDetailPage() {
  const params = useParams({ strict: false });
  const slug = (params as { slug?: string }).slug ?? "";
  const { data: product, isLoading, isError } = useProduct(slug);

  const addToCart = useAddToCart();
  const { openCart } = useCartUI();

  const [selected, setSelected] = useState<Record<string, string>>({});
  // Direct variant pick for products with multiple variants but NO option types
  // (the common seed shape, e.g. "4GB" / "8GB" variants without a "Capacity"
  // option type). `null` means "use the first variant".
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  // Default the selection to the first variant's option values once loaded.
  const defaultSelected = useMemo<Record<string, string>>(() => {
    if (!product || product.variants.length === 0) return {};
    const first = product.variants[0];
    const sel: Record<string, string> = {};
    for (const ot of product.optionTypes) {
      const match = ot.values.find((v) => first.optionValueIds.includes(v.id));
      if (match) sel[ot.id] = match.id;
    }
    return sel;
  }, [product]);

  const effectiveSelected =
    Object.keys(selected).length > 0 ? selected : defaultSelected;

  const resolvedVariant = useMemo(() => {
    if (!product) return undefined;
    if (product.optionTypes.length === 0) {
      return (
        product.variants.find((v) => v.id === variantId) ?? product.variants[0]
      );
    }
    return product.variants.find((v) =>
      product.optionTypes.every((ot) =>
        v.optionValueIds.includes(effectiveSelected[ot.id]),
      ),
    );
  }, [product, effectiveSelected, variantId]);

  const backLink = (
    <Button asChild variant="ghost" size="sm">
      <Link to="/">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to shop
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className={`${MAXW} flex flex-col gap-6 px-6 py-12`}>
        {backLink}
        <div className="grid gap-10 md:grid-cols-2">
          <div className="aspect-square animate-pulse border-2 border-line bg-paper-2" />
          <div className="flex flex-col gap-4">
            <div className="h-8 w-3/4 animate-pulse bg-paper-2" />
            <div className="h-6 w-1/3 animate-pulse bg-paper-2" />
            <div className="h-24 w-full animate-pulse bg-paper-2" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className={`${MAXW} flex flex-col items-center gap-4 px-6 py-24 text-center`}>
        <p className="cr-mono text-soldout">// 404</p>
        <h1 className="font-sans text-[2rem] font-bold tracking-[-0.02em] text-ink">
          Product not found
        </h1>
        <p className="max-w-md text-smoke">
          This product may have been removed or is not currently available.
        </p>
        <Button asChild variant="primary">
          <Link to="/">Back to shop</Link>
        </Button>
      </div>
    );
  }

  const availability = resolvedVariant?.availability;
  const availMeta = availability ? AVAILABILITY_META[availability] : null;
  const soldOut = availability === "OUT";
  const canAdd = Boolean(resolvedVariant) && !soldOut;

  const price = resolvedVariant
    ? peso2(resolvedVariant.price)
    : product.priceMin === product.priceMax
      ? peso2(product.priceMin)
      : `${peso2(product.priceMin)} – ${peso2(product.priceMax)}`;

  const compareAt =
    resolvedVariant?.compareAtPrice &&
    resolvedVariant.compareAtPrice > resolvedVariant.price
      ? resolvedVariant.compareAtPrice
      : null;

  async function handleAdd() {
    if (!resolvedVariant) return;
    await addToCart.mutateAsync({
      variantId: resolvedVariant.id,
      quantity: qty,
    });
    openCart();
  }

  return (
    <div className={`${MAXW} flex flex-col gap-8 px-6 py-12`}>
      {backLink}

      <div className="grid gap-10 md:grid-cols-2">
        <Gallery images={product.images} title={product.title} />

        <div className="flex flex-col gap-5">
          {product.brand && (
            <span className="font-mono text-[0.75rem] uppercase tracking-[0.08em] text-smoke">
              {product.brand}
            </span>
          )}
          <h1 className="font-sans text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
            {product.title}
          </h1>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[1.75rem] font-bold text-ink">
              {price}
            </span>
            {compareAt && (
              <span className="font-mono text-[1rem] text-smoke line-through">
                {peso2(compareAt)}
              </span>
            )}
          </div>

          {availMeta && (
            <Badge variant={availMeta.variant} size="md">
              {availMeta.label}
            </Badge>
          )}

          {/* Direct variant picker (no option types, but >1 variant) */}
          {product.optionTypes.length === 0 && product.variants.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.08em] text-smoke">
                Variant
              </span>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const isSel = resolvedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setVariantId(v.id);
                        setQty(1);
                      }}
                      className={
                        "cr-press border-2 px-3.5 py-2 font-sans text-sm font-semibold shadow-press " +
                        (isSel
                          ? "border-ink bg-signal text-ink"
                          : "border-line bg-paper text-ink hover:border-ink")
                      }
                    >
                      {v.title ?? v.sku}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Option pickers */}
          {product.optionTypes.map((ot) => (
            <div key={ot.id} className="flex flex-col gap-2">
              <span className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.08em] text-smoke">
                {ot.name}
              </span>
              <div className="flex flex-wrap gap-2">
                {ot.values.map((val) => {
                  const isSel = effectiveSelected[ot.id] === val.id;
                  return (
                    <button
                      key={val.id}
                      type="button"
                      onClick={() => {
                        setSelected({ ...effectiveSelected, [ot.id]: val.id });
                        setQty(1);
                      }}
                      className={
                        "cr-press border-2 px-3.5 py-2 font-sans text-sm font-semibold shadow-press " +
                        (isSel
                          ? "border-ink bg-signal text-ink"
                          : "border-line bg-paper text-ink hover:border-ink")
                      }
                    >
                      {val.value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!resolvedVariant && (
            <p className="font-mono text-[0.8125rem] text-soldout">
              That combination isn't available — try different options.
            </p>
          )}

          {/* Quantity + Add */}
          <div className="mt-2 flex flex-wrap items-stretch gap-3">
            <div className="flex items-center border-2 border-line bg-paper shadow-press">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex size-11 items-center justify-center text-ink hover:bg-signal"
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <span className="min-w-10 text-center font-mono text-[0.9375rem] text-ink">
                {qty}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty((q) => Math.min(999, q + 1))}
                className="flex size-11 items-center justify-center text-ink hover:bg-signal"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1"
              disabled={!canAdd || addToCart.isPending}
              onClick={handleAdd}
            >
              {soldOut
                ? "Sold out"
                : addToCart.isPending
                  ? "Adding…"
                  : "Add to cart →"}
            </Button>
          </div>

          {resolvedVariant && (
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
              SKU: {resolvedVariant.sku}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <section className="flex flex-col gap-3 border-t-2 border-line pt-8">
          <h2 className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.08em] text-smoke">
            // description
          </h2>
          <p className="max-w-[68ch] whitespace-pre-line text-[1rem] leading-[1.7] text-ink">
            {product.description}
          </p>
        </section>
      )}

      {/* Specs */}
      {product.specGroups.length > 0 && (
        <section className="flex flex-col gap-4 border-t-2 border-line pt-8">
          <h2 className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.08em] text-smoke">
            // specifications
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {product.specGroups.map((group, gi) => (
              <div key={group.group ?? gi} className="flex flex-col">
                {group.group && (
                  <span className="mb-2 font-sans text-[0.9375rem] font-bold text-ink">
                    {group.group}
                  </span>
                )}
                <dl className="border-2 border-line">
                  {group.items.map((item, ii) => (
                    <div
                      key={item.key + ii}
                      className="flex justify-between gap-4 border-b border-line px-3 py-2 last:border-b-0 odd:bg-paper even:bg-paper-2"
                    >
                      <dt className="font-mono text-[0.8125rem] text-smoke">
                        {item.key}
                      </dt>
                      <dd className="text-right font-mono text-[0.8125rem] text-ink">
                        {item.value}
                        {item.unit ? ` ${item.unit}` : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
