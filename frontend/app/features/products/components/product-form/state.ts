/**
 * circuit.rocks admin — Create-product form: client-only state model + helpers.
 *
 * This module is the single source of truth for the create-product form's
 * shape, the matrix (option → variant) generation, and the `buildPayload`
 * serialiser that strips every client-only field down to the EXACT backend
 * contract (`POST /admin/products`). Pure functions only — no React.
 */

import type { BrandOption, CategoryOption } from "../../types/products.types";

/* ------------------------------------------------------------------ *
 * Enums (mirror the backend)
 * ------------------------------------------------------------------ */

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const SOURCING_TYPES = ["PURCHASED", "BUILT"] as const;
export type SourcingType = (typeof SOURCING_TYPES)[number];

/* ------------------------------------------------------------------ *
 * Client-only drafts
 * ------------------------------------------------------------------ */

/** One option type (e.g. "RAM") and its ordered value strings. */
export interface OptionTypeDraft {
  name: string;
  values: string[];
}

/**
 * Per-variant editable state. `skuTouched` and the `stock` map are client-only
 * and stripped in `buildPayload`. Money fields are STRINGS end-to-end.
 */
export interface VariantDraft {
  sku: string;
  skuTouched: boolean;
  barcode: string;
  title: string;
  sourcingType: SourcingType;
  price: string;
  compareAtPrice: string;
  weightGrams: string;
  isActive: boolean;
  reorderPoint: string;
  reorderQty: string;
  /** warehouseId → onHand (string; blank = not stocked). */
  stock: Record<string, string>;
}

/** An image row. `variantKey` is the comboKey of the variant it belongs to. */
export interface ImageDraft {
  url: string;
  alt: string;
  isPrimary: boolean;
  variantKey: string;
}

/** A spec row. */
export interface SpecDraft {
  group: string;
  key: string;
  value: string;
  unit: string;
}

/** The whole form. */
export interface ProductFormState {
  title: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  status: ProductStatus;
  metaTitle: string;
  metaDescription: string;
  brandId: string;
  categoryIds: string[];
  optionTypes: OptionTypeDraft[];
  /** comboKey → draft. The live variant list is derived from optionTypes. */
  variantEdits: Record<string, VariantDraft>;
  images: ImageDraft[];
  specs: SpecDraft[];
}

/* ------------------------------------------------------------------ *
 * Pure helpers
 * ------------------------------------------------------------------ */

/** Lowercase, hyphenate, strip non url-safe chars. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Short code for a single option value (used to build SKU suffixes). */
function shortCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
}

/** Cartesian product of value arrays. `[]` → `[[]]` (single default variant). */
export function cartesian(lists: string[][]): string[][] {
  return lists.reduce<string[][]>(
    (acc, list) => acc.flatMap((combo) => list.map((v) => [...combo, v])),
    [[]],
  );
}

/** Stable key for a combo. `[]` → "" (the lone default variant). */
export function comboKey(combo: string[]): string {
  return combo.join(" / ");
}

/**
 * Generate the ordered list of live variant combos from the option types.
 * Any option type with zero non-blank values collapses the matrix to a single
 * default variant (`[[]]`), matching the backend's "no options" case.
 */
export function generateCombos(optionTypes: OptionTypeDraft[]): string[][] {
  const lists = optionTypes
    .map((t) => t.values.map((v) => v.trim()).filter(Boolean))
    .filter((vals) => vals.length > 0);

  if (lists.length === 0 || lists.length !== optionTypes.length) {
    // No usable option types (or some type has 0 values) → single default.
    return [[]];
  }
  return cartesian(lists);
}

/** Auto-suggested SKU: `<TITLE-SLUG>-<CODE1>-<CODE2>` uppercased. */
export function suggestSku(title: string, combo: string[]): string {
  const base = slugify(title || "sku").toUpperCase();
  const suffix = combo.map(shortCode).filter(Boolean).join("-");
  return suffix ? `${base}-${suffix}` : base;
}

/** A fresh variant draft for a combo (auto-derived SKU + title). */
export function defaultDraft(title: string, combo: string[]): VariantDraft {
  return {
    sku: suggestSku(title, combo),
    skuTouched: false,
    barcode: "",
    title: combo.length > 0 ? comboKey(combo) : "",
    sourcingType: "PURCHASED",
    price: "",
    compareAtPrice: "",
    weightGrams: "",
    isActive: true,
    reorderPoint: "",
    reorderQty: "",
    stock: {},
  };
}

/** Empty initial form state. */
export function initialState(): ProductFormState {
  return {
    title: "",
    slug: "",
    slugTouched: false,
    description: "",
    status: "DRAFT",
    metaTitle: "",
    metaDescription: "",
    brandId: "",
    categoryIds: [],
    optionTypes: [],
    variantEdits: {},
    images: [],
    specs: [],
  };
}

/**
 * Reconcile `variantEdits` against the current combos: keep existing edits by
 * comboKey, create `defaultDraft`s for new combos, drop stale keys, and
 * re-derive the SKU for any variant whose SKU the user has NOT touched.
 */
export function reconcileVariantEdits(
  state: ProductFormState,
): Record<string, VariantDraft> {
  const combos = generateCombos(state.optionTypes);
  const next: Record<string, VariantDraft> = {};
  for (const combo of combos) {
    const key = comboKey(combo);
    const existing = state.variantEdits[key];
    if (existing) {
      next[key] = existing.skuTouched
        ? existing
        : { ...existing, sku: suggestSku(state.title, combo) };
    } else {
      next[key] = defaultDraft(state.title, combo);
    }
  }
  return next;
}

/* ------------------------------------------------------------------ *
 * Derived: the ordered live variant list (used by the UI + payload)
 * ------------------------------------------------------------------ */

export interface LiveVariant {
  key: string;
  combo: string[];
  draft: VariantDraft;
}

/** Ordered, deterministic list of the variants currently in the form. */
export function liveVariants(state: ProductFormState): LiveVariant[] {
  const combos = generateCombos(state.optionTypes);
  return combos.map((combo) => {
    const key = comboKey(combo);
    return {
      key,
      combo,
      draft: state.variantEdits[key] ?? defaultDraft(state.title, combo),
    };
  });
}

/* ------------------------------------------------------------------ *
 * buildPayload — EXACT backend contract, client-only fields stripped
 * ------------------------------------------------------------------ */

/** Trim a string; return undefined when empty (so we omit, never send ""). */
function opt(value: string): string | undefined {
  const v = value.trim();
  return v === "" ? undefined : v;
}

export interface ProductPayload {
  title: string;
  slug: string;
  description: string;
  status: ProductStatus;
  brandId?: string;
  categoryIds: string[];
  metaTitle: string;
  metaDescription: string;
  optionTypes: { name: string; values: { value: string }[] }[];
  variants: {
    sku: string;
    barcode: string;
    title: string;
    sourcingType: SourcingType;
    price: string;
    compareAtPrice?: string;
    weightGrams?: number;
    isActive: boolean;
    optionValues: string[];
    reorderPoint?: string;
    reorderQty?: string;
    stock: { warehouseId: string; onHand: string }[];
  }[];
  images: {
    url: string;
    alt: string;
    isPrimary: boolean;
    variantIndex?: number;
  }[];
  specs: { group: string; key: string; value: string; unit: string }[];
}

/**
 * Serialise the form to the EXACT `POST /admin/products` body. Strips every
 * client-only field (`skuTouched`, `slugTouched`, comboKey, `variantKey`,
 * blank stock cells), keeps variants in deterministic combo order, and aligns
 * each variant's `optionValues` to `optionTypes` order.
 */
export function buildPayload(state: ProductFormState): ProductPayload {
  const variants = liveVariants(state);
  const keyToIndex = new Map(variants.map((v, i) => [v.key, i]));

  const weight = (raw: string): number | undefined => {
    const t = raw.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    title: state.title.trim(),
    slug: state.slug.trim(),
    description: state.description,
    status: state.status,
    brandId: opt(state.brandId),
    categoryIds: state.categoryIds,
    metaTitle: state.metaTitle,
    metaDescription: state.metaDescription,
    optionTypes: state.optionTypes
      .map((t) => ({
        name: t.name.trim(),
        values: t.values
          .map((v) => v.trim())
          .filter(Boolean)
          .map((value) => ({ value })),
      }))
      .filter((t) => t.name !== "" && t.values.length > 0),
    variants: variants.map(({ combo, draft }) => ({
      sku: draft.sku.trim(),
      barcode: draft.barcode,
      title: draft.title,
      sourcingType: draft.sourcingType,
      price: draft.price.trim(),
      compareAtPrice: opt(draft.compareAtPrice),
      weightGrams: weight(draft.weightGrams),
      isActive: draft.isActive,
      optionValues: combo,
      reorderPoint: opt(draft.reorderPoint),
      reorderQty: opt(draft.reorderQty),
      stock: Object.entries(draft.stock)
        .map(([warehouseId, onHand]) => ({ warehouseId, onHand: onHand.trim() }))
        .filter((s) => s.onHand !== ""),
    })),
    images: state.images
      .filter((img) => img.url.trim() !== "")
      .map((img) => {
        const variantIndex = img.variantKey
          ? keyToIndex.get(img.variantKey)
          : undefined;
        return {
          url: img.url.trim(),
          alt: img.alt,
          isPrimary: img.isPrimary,
          ...(variantIndex !== undefined ? { variantIndex } : {}),
        };
      }),
    specs: state.specs
      .filter((s) => s.key.trim() !== "" || s.value.trim() !== "")
      .map((s) => ({
        group: s.group,
        key: s.key,
        value: s.value,
        unit: s.unit,
      })),
  };
}

/* Re-export option types referenced by sub-components for convenience. */
export type { BrandOption, CategoryOption };
