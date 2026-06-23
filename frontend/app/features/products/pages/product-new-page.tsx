/**
 * circuit.rocks — products feature: create-product page.
 *
 * Ported from the old SSR `routes/admin/products.new.tsx`. The loader/action are
 * gone:
 *   - options load via `useProductFormOptions()`
 *   - the `useReducer` variant matrix is KEPT VERBATIM (see product-form/state.ts)
 *   - on submit we `createProductSchema.safeParse(buildPayload(state))`; client
 *     zod issues map onto cells immediately (no round-trip)
 *   - a valid payload goes to `useCreateProduct().mutateAsync`; on 400/409 we map
 *     `unwrapFieldErrors(error)` back onto the same dotted-path cells
 *   - on success we navigate to the products list
 *
 * CANONICAL PATTERN for a create form with field-error mapping:
 *   buildPayload(state) → schema.safeParse → on !success render `error.flatten`
 *   field errors; else mutateAsync → catch → `unwrapFieldErrors` → setFieldErrors.
 */

import { useMemo, useReducer, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Layers, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "~/components/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { unwrapFieldErrors } from "~/lib/axios";
import { useCreateProduct } from "../hooks/use-create-product";
import { useProductFormOptions } from "../hooks/use-product-form-options";
import {
  createProductSchema,
  type BrandOption,
  type CategoryOption,
} from "../types/products.types";
import {
  CellInput,
  SelectField,
  TextAreaField,
  TextField,
  errorFor,
  labelClass,
  type FieldErrors,
} from "../components/product-form/fields";
import { InlineCreate } from "../components/product-form/inline-create";
import {
  buildPayload,
  initialState,
  liveVariants,
  reconcileVariantEdits,
  slugify,
  suggestSku,
  PRODUCT_STATUSES,
  SOURCING_TYPES,
  type ImageDraft,
  type OptionTypeDraft,
  type ProductFormState,
  type SpecDraft,
  type VariantDraft,
} from "../components/product-form/state";

/* ------------------------------------------------------------------ *
 * Reducer (verbatim port from the old route)
 * ------------------------------------------------------------------ */

type Action =
  | { type: "set-title"; value: string }
  | { type: "set-slug"; value: string }
  | { type: "set-field"; field: "description" | "status" | "metaTitle" | "metaDescription"; value: string }
  | { type: "set-brand"; value: string }
  | { type: "toggle-category"; id: string }
  | { type: "add-option-type" }
  | { type: "remove-option-type"; index: number }
  | { type: "set-option-name"; index: number; value: string }
  | { type: "set-option-values"; index: number; value: string }
  | { type: "patch-variant"; key: string; patch: Partial<VariantDraft> }
  | { type: "set-stock"; key: string; warehouseId: string; value: string }
  | { type: "add-image" }
  | { type: "remove-image"; index: number }
  | { type: "patch-image"; index: number; patch: Partial<ImageDraft> }
  | { type: "set-primary-image"; index: number }
  | { type: "add-spec" }
  | { type: "remove-spec"; index: number }
  | { type: "patch-spec"; index: number; patch: Partial<SpecDraft> };

function withReconciledVariants(state: ProductFormState): ProductFormState {
  return { ...state, variantEdits: reconcileVariantEdits(state) };
}

function reducer(state: ProductFormState, action: Action): ProductFormState {
  switch (action.type) {
    case "set-title": {
      const next: ProductFormState = {
        ...state,
        title: action.value,
        slug: state.slugTouched ? state.slug : slugify(action.value),
      };
      return withReconciledVariants(next);
    }
    case "set-slug":
      return { ...state, slug: action.value, slugTouched: true };
    case "set-field":
      return { ...state, [action.field]: action.value };
    case "set-brand":
      return { ...state, brandId: action.value };
    case "toggle-category": {
      const has = state.categoryIds.includes(action.id);
      return {
        ...state,
        categoryIds: has
          ? state.categoryIds.filter((c) => c !== action.id)
          : [...state.categoryIds, action.id],
      };
    }
    case "add-option-type":
      return withReconciledVariants({
        ...state,
        optionTypes: [...state.optionTypes, { name: "", values: [] }],
      });
    case "remove-option-type":
      return withReconciledVariants({
        ...state,
        optionTypes: state.optionTypes.filter((_, i) => i !== action.index),
      });
    case "set-option-name": {
      const optionTypes = state.optionTypes.map((t, i): OptionTypeDraft =>
        i === action.index ? { ...t, name: action.value } : t,
      );
      return { ...state, optionTypes };
    }
    case "set-option-values": {
      const values = action.value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const optionTypes = state.optionTypes.map((t, i): OptionTypeDraft =>
        i === action.index ? { ...t, values } : t,
      );
      return withReconciledVariants({ ...state, optionTypes });
    }
    case "patch-variant": {
      const existing = state.variantEdits[action.key];
      if (!existing) return state;
      const patched = { ...existing, ...action.patch };
      if (action.patch.sku !== undefined) patched.skuTouched = true;
      return {
        ...state,
        variantEdits: { ...state.variantEdits, [action.key]: patched },
      };
    }
    case "set-stock": {
      const existing = state.variantEdits[action.key];
      if (!existing) return state;
      const stock = { ...existing.stock, [action.warehouseId]: action.value };
      return {
        ...state,
        variantEdits: {
          ...state.variantEdits,
          [action.key]: { ...existing, stock },
        },
      };
    }
    case "add-image":
      return {
        ...state,
        images: [
          ...state.images,
          {
            url: "",
            alt: "",
            isPrimary: state.images.length === 0,
            variantKey: "",
          },
        ],
      };
    case "remove-image":
      return {
        ...state,
        images: state.images.filter((_, i) => i !== action.index),
      };
    case "patch-image":
      return {
        ...state,
        images: state.images.map((img, i) =>
          i === action.index ? { ...img, ...action.patch } : img,
        ),
      };
    case "set-primary-image":
      return {
        ...state,
        images: state.images.map((img, i) => ({
          ...img,
          isPrimary: i === action.index,
        })),
      };
    case "add-spec":
      return {
        ...state,
        specs: [...state.specs, { group: "", key: "", value: "", unit: "" }],
      };
    case "remove-spec":
      return {
        ...state,
        specs: state.specs.filter((_, i) => i !== action.index),
      };
    case "patch-spec":
      return {
        ...state,
        specs: state.specs.map((s, i) =>
          i === action.index ? { ...s, ...action.patch } : s,
        ),
      };
    default:
      return state;
  }
}

/** Option-list reducer (append unique by id) — keeps inline-created items. */
function appendOption<T extends { id: string }>(prev: T[], next: T): T[] {
  return prev.some((o) => o.id === next.id) ? prev : [...prev, next];
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export function ProductNewPage() {
  const navigate = useNavigate();
  const optionsQuery = useProductFormOptions();
  const createProduct = useCreateProduct();

  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // Field + form errors mapped onto the matrix (zod client issues OR backend).
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Local, mutable copies of the options so inline-created items appear.
  const [brands, dispatchBrands] = useReducer(
    appendOption<BrandOption>,
    [] as BrandOption[],
  );
  const [categories, dispatchCategories] = useReducer(
    appendOption<CategoryOption>,
    [] as CategoryOption[],
  );

  // Merge fetched options with locally inline-created ones (deduped by id).
  const fetchedBrands = optionsQuery.data?.brands ?? [];
  const fetchedCategories = optionsQuery.data?.categories ?? [];
  const warehouses = optionsQuery.data?.warehouses ?? [];
  const allBrands = useMemo(
    () => [...fetchedBrands, ...brands.filter((b) => !fetchedBrands.some((f) => f.id === b.id))],
    [fetchedBrands, brands],
  );
  const allCategories = useMemo(
    () =>
      [
        ...fetchedCategories,
        ...categories.filter((c) => !fetchedCategories.some((f) => f.id === c.id)),
      ],
    [fetchedCategories, categories],
  );

  const variants = useMemo(() => liveVariants(state), [state]);

  const hasOptions = state.optionTypes.length > 0;
  const submitting = createProduct.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormErrors([]);

    const payload = buildPayload(state);

    // 1. Client-side validation: zod issues map onto cells immediately.
    const parsed = createProductSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors);
      const top = parsed.error.flatten().formErrors;
      setFormErrors(
        top.length > 0
          ? top
          : ["Please fix the highlighted fields and try again."],
      );
      return;
    }

    // 2. Server: on 400/409 map backend fieldErrors/formErrors onto the cells.
    try {
      await createProduct.mutateAsync(parsed.data);
      navigate({ to: "/products" });
    } catch (err) {
      const unwrapped = unwrapFieldErrors(err);
      if (unwrapped) {
        setFieldErrors(unwrapped.fieldErrors);
        setFormErrors(unwrapped.formErrors);
      } else {
        setFormErrors(["Could not create product. Please try again."]);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-28">
      <PageHeader
        title="New product"
        description="Create a product with its variants, stock, images and specs."
      />

      {formErrors.length > 0 ? (
        <Card className="border-soldout">
          <CardContent className="gap-1.5 p-4">
            <p className="cr-mono text-soldout">// could not create product</p>
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
          </CardContent>
        </Card>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* ── Details ── */}
        <Card>
          <CardHeader className="border-b-2 border-line">
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="gap-4 p-6">
            <TextField
              label="Title"
              path="title"
              errors={fieldErrors}
              value={state.title}
              onChange={(e) =>
                dispatch({ type: "set-title", value: e.target.value })
              }
              placeholder="Raspberry Pi 5"
            />
            <TextField
              label="Slug"
              path="slug"
              errors={fieldErrors}
              value={state.slug}
              onChange={(e) =>
                dispatch({ type: "set-slug", value: e.target.value })
              }
              placeholder="raspberry-pi-5"
              hint="Auto-derived from the title until you edit it."
            />
            <TextAreaField
              label="Description"
              path="description"
              errors={fieldErrors}
              value={state.description}
              onChange={(e) =>
                dispatch({
                  type: "set-field",
                  field: "description",
                  value: e.target.value,
                })
              }
              placeholder="Short product description…"
            />
            <SelectField
              label="Status"
              path="status"
              errors={fieldErrors}
              value={state.status}
              onChange={(e) =>
                dispatch({
                  type: "set-field",
                  field: "status",
                  value: e.target.value,
                })
              }
              className="max-w-xs"
            >
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
          </CardContent>
        </Card>

        {/* ── Organization ── */}
        <Card>
          <CardHeader className="border-b-2 border-line">
            <CardTitle>Organization</CardTitle>
          </CardHeader>
          <CardContent className="gap-5 p-6">
            <div className="flex flex-col gap-2">
              <SelectField
                label="Brand"
                path="brandId"
                errors={fieldErrors}
                value={state.brandId}
                onChange={(e) =>
                  dispatch({ type: "set-brand", value: e.target.value })
                }
                className="max-w-sm"
              >
                <option value="">— No brand —</option>
                {allBrands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </SelectField>
              <InlineCreate
                kind="brand"
                onCreated={(opt) => {
                  dispatchBrands(opt as BrandOption);
                  dispatch({ type: "set-brand", value: opt.id });
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className={labelClass}>Categories</span>
              {allCategories.length === 0 ? (
                <p className="font-mono text-[0.75rem] text-smoke">
                  No categories yet — create one below.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allCategories.map((c) => {
                    const checked = state.categoryIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={
                          "inline-flex cursor-pointer items-center gap-2 border-2 border-line px-3 py-1.5 font-mono text-[0.75rem] " +
                          (checked
                            ? "bg-signal text-ink"
                            : "bg-paper text-smoke hover:text-ink")
                        }
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() =>
                            dispatch({ type: "toggle-category", id: c.id })
                          }
                        />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              )}
              {errorFor(fieldErrors, "categoryIds") ? (
                <p className="font-mono text-[0.6875rem] text-soldout">
                  {errorFor(fieldErrors, "categoryIds")}
                </p>
              ) : null}
              <InlineCreate
                kind="category"
                onCreated={(opt) => {
                  dispatchCategories(opt as CategoryOption);
                  dispatch({ type: "toggle-category", id: opt.id });
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Options ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b-2 border-line">
            <CardTitle>Options</CardTitle>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => dispatch({ type: "add-option-type" })}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add option
            </Button>
          </CardHeader>
          <CardContent className="gap-4 p-6">
            {!hasOptions ? (
              <p className="font-mono text-[0.8125rem] text-smoke">
                No options — this product will have a single default variant.
                Add an option (e.g. RAM, Color) to generate a variant matrix.
              </p>
            ) : (
              state.optionTypes.map((t, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 border-2 border-line bg-paper-2 p-4 sm:flex-row sm:items-end"
                >
                  <TextField
                    label="Option name"
                    path={`optionTypes.${i}.name`}
                    errors={fieldErrors}
                    value={t.name}
                    onChange={(e) =>
                      dispatch({
                        type: "set-option-name",
                        index: i,
                        value: e.target.value,
                      })
                    }
                    placeholder="RAM"
                    className="sm:w-48"
                  />
                  <TextField
                    label="Values (comma-separated)"
                    path={`optionTypes.${i}.values`}
                    errors={fieldErrors}
                    defaultValue={t.values.join(", ")}
                    onBlur={(e) =>
                      dispatch({
                        type: "set-option-values",
                        index: i,
                        value: e.target.value,
                      })
                    }
                    placeholder="4GB, 8GB"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      dispatch({ type: "remove-option-type", index: i })
                    }
                    aria-label={`Remove option ${i + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ── Variants ── */}
        <Card>
          <CardHeader className="border-b-2 border-line">
            <CardTitle>
              Variants
              <Badge variant="neutral" size="sm" className="ml-2">
                {variants.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="gap-4 p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-line bg-paper-2">
                    {[
                      "Variant",
                      "SKU",
                      "Price",
                      "Compare at",
                      "Sourcing",
                      "Weight (g)",
                      "Active",
                    ].map((h) => (
                      <th
                        key={h}
                        className="cr-micro whitespace-nowrap px-3 py-2.5 text-left text-smoke"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => (
                    <tr key={v.key} className="border-b-2 border-line align-top">
                      <td className="px-3 py-2 font-mono text-[0.8125rem] text-ink">
                        {v.combo.length > 0 ? v.key : "Default"}
                      </td>
                      <td className="px-3 py-2">
                        <CellInput
                          value={v.draft.sku}
                          onChange={(e) =>
                            dispatch({
                              type: "patch-variant",
                              key: v.key,
                              patch: { sku: e.target.value },
                            })
                          }
                          placeholder={suggestSku(state.title, v.combo)}
                          className="min-w-[10rem]"
                          aria-label={`SKU for ${v.key || "default"}`}
                        />
                        {errorFor(fieldErrors, `variants.${i}.sku`) ? (
                          <p className="mt-1 font-mono text-[0.6875rem] text-soldout">
                            {errorFor(fieldErrors, `variants.${i}.sku`)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <CellInput
                          inputMode="decimal"
                          value={v.draft.price}
                          onChange={(e) =>
                            dispatch({
                              type: "patch-variant",
                              key: v.key,
                              patch: { price: e.target.value },
                            })
                          }
                          placeholder="0.00"
                          className="w-28"
                          aria-label={`Price for ${v.key || "default"}`}
                        />
                        {errorFor(fieldErrors, `variants.${i}.price`) ? (
                          <p className="mt-1 font-mono text-[0.6875rem] text-soldout">
                            {errorFor(fieldErrors, `variants.${i}.price`)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <CellInput
                          inputMode="decimal"
                          value={v.draft.compareAtPrice}
                          onChange={(e) =>
                            dispatch({
                              type: "patch-variant",
                              key: v.key,
                              patch: { compareAtPrice: e.target.value },
                            })
                          }
                          placeholder="0.00"
                          className="w-28"
                          aria-label={`Compare-at price for ${v.key || "default"}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={v.draft.sourcingType}
                          onChange={(e) =>
                            dispatch({
                              type: "patch-variant",
                              key: v.key,
                              patch: {
                                sourcingType: e.target
                                  .value as VariantDraft["sourcingType"],
                              },
                            })
                          }
                          className="cursor-pointer border-2 border-line bg-paper px-2 py-2 font-mono text-[0.75rem] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
                          aria-label={`Sourcing for ${v.key || "default"}`}
                        >
                          {SOURCING_TYPES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <CellInput
                          inputMode="numeric"
                          value={v.draft.weightGrams}
                          onChange={(e) =>
                            dispatch({
                              type: "patch-variant",
                              key: v.key,
                              patch: { weightGrams: e.target.value },
                            })
                          }
                          placeholder="0"
                          className="w-20"
                          aria-label={`Weight for ${v.key || "default"}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={v.draft.isActive}
                          onChange={(e) =>
                            dispatch({
                              type: "patch-variant",
                              key: v.key,
                              patch: { isActive: e.target.checked },
                            })
                          }
                          aria-label={`Active for ${v.key || "default"}`}
                          className="size-4 accent-signal"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Stock by warehouse ── */}
        <Card>
          <CardHeader className="border-b-2 border-line">
            <CardTitle>Stock by warehouse</CardTitle>
          </CardHeader>
          <CardContent className="gap-4 p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-line bg-paper-2">
                    <th className="cr-micro px-3 py-2.5 text-left text-smoke">
                      Variant
                    </th>
                    <th className="cr-micro px-3 py-2.5 text-left text-smoke">
                      Reorder pt
                    </th>
                    <th className="cr-micro px-3 py-2.5 text-left text-smoke">
                      Reorder qty
                    </th>
                    {warehouses.map((w) => (
                      <th
                        key={w.id}
                        className="cr-micro whitespace-nowrap px-3 py-2.5 text-left text-smoke"
                      >
                        {w.code}
                        {w.isDefaultWeb ? (
                          <span className="ml-1 text-signal">●</span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.key} className="border-b-2 border-line">
                      <td className="px-3 py-2 font-mono text-[0.8125rem] text-ink">
                        {v.combo.length > 0 ? v.key : "Default"}
                      </td>
                      <td className="px-3 py-2">
                        <CellInput
                          inputMode="numeric"
                          value={v.draft.reorderPoint}
                          onChange={(e) =>
                            dispatch({
                              type: "patch-variant",
                              key: v.key,
                              patch: { reorderPoint: e.target.value },
                            })
                          }
                          placeholder="0"
                          className="w-20"
                          aria-label={`Reorder point for ${v.key || "default"}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <CellInput
                          inputMode="numeric"
                          value={v.draft.reorderQty}
                          onChange={(e) =>
                            dispatch({
                              type: "patch-variant",
                              key: v.key,
                              patch: { reorderQty: e.target.value },
                            })
                          }
                          placeholder="0"
                          className="w-20"
                          aria-label={`Reorder qty for ${v.key || "default"}`}
                        />
                      </td>
                      {warehouses.map((w) => (
                        <td key={w.id} className="px-3 py-2">
                          <CellInput
                            inputMode="numeric"
                            value={v.draft.stock[w.id] ?? ""}
                            onChange={(e) =>
                              dispatch({
                                type: "set-stock",
                                key: v.key,
                                warehouseId: w.id,
                                value: e.target.value,
                              })
                            }
                            placeholder=""
                            className="w-20"
                            aria-label={`On hand at ${w.code} for ${v.key || "default"}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Images ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b-2 border-line">
            <CardTitle>Images</CardTitle>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => dispatch({ type: "add-image" })}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add image
            </Button>
          </CardHeader>
          <CardContent className="gap-4 p-6">
            {state.images.length === 0 ? (
              <p className="font-mono text-[0.8125rem] text-smoke">
                No images yet.
              </p>
            ) : (
              state.images.map((img, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 border-2 border-line bg-paper-2 p-4 lg:flex-row lg:items-end"
                >
                  <TextField
                    label="URL"
                    path={`images.${i}.url`}
                    errors={fieldErrors}
                    value={img.url}
                    onChange={(e) =>
                      dispatch({
                        type: "patch-image",
                        index: i,
                        patch: { url: e.target.value },
                      })
                    }
                    placeholder="/products/rpi5.jpg"
                    className="flex-1"
                  />
                  <TextField
                    label="Alt"
                    value={img.alt}
                    onChange={(e) =>
                      dispatch({
                        type: "patch-image",
                        index: i,
                        patch: { alt: e.target.value },
                      })
                    }
                    placeholder="RPi 5"
                    className="flex-1"
                  />
                  <SelectField
                    label="Variant"
                    value={img.variantKey}
                    onChange={(e) =>
                      dispatch({
                        type: "patch-image",
                        index: i,
                        patch: { variantKey: e.target.value },
                      })
                    }
                    className="lg:w-44"
                  >
                    <option value="">— Product —</option>
                    {variants.map((v) => (
                      <option key={v.key} value={v.key}>
                        {v.combo.length > 0 ? v.key : "Default"}
                      </option>
                    ))}
                  </SelectField>
                  <label className="flex items-center gap-2 whitespace-nowrap font-mono text-[0.75rem] text-ink lg:pb-2.5">
                    <input
                      type="radio"
                      name="primaryImage"
                      checked={img.isPrimary}
                      onChange={() =>
                        dispatch({ type: "set-primary-image", index: i })
                      }
                      className="size-4 accent-signal"
                    />
                    Primary
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatch({ type: "remove-image", index: i })}
                    aria-label={`Remove image ${i + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ── Specs ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b-2 border-line">
            <CardTitle>Specs</CardTitle>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => dispatch({ type: "add-spec" })}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add spec
            </Button>
          </CardHeader>
          <CardContent className="gap-4 p-6">
            {state.specs.length === 0 ? (
              <p className="font-mono text-[0.8125rem] text-smoke">
                No specs yet.
              </p>
            ) : (
              state.specs.map((s, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 border-2 border-line bg-paper-2 p-4 sm:flex-row sm:items-end"
                >
                  <TextField
                    label="Group"
                    value={s.group}
                    onChange={(e) =>
                      dispatch({
                        type: "patch-spec",
                        index: i,
                        patch: { group: e.target.value },
                      })
                    }
                    placeholder="Compute"
                    className="sm:w-40"
                  />
                  <TextField
                    label="Key"
                    value={s.key}
                    onChange={(e) =>
                      dispatch({
                        type: "patch-spec",
                        index: i,
                        patch: { key: e.target.value },
                      })
                    }
                    placeholder="CPU"
                    className="sm:w-40"
                  />
                  <TextField
                    label="Value"
                    value={s.value}
                    onChange={(e) =>
                      dispatch({
                        type: "patch-spec",
                        index: i,
                        patch: { value: e.target.value },
                      })
                    }
                    placeholder="Cortex-A76"
                    className="flex-1"
                  />
                  <TextField
                    label="Unit"
                    value={s.unit}
                    onChange={(e) =>
                      dispatch({
                        type: "patch-spec",
                        index: i,
                        patch: { unit: e.target.value },
                      })
                    }
                    placeholder=""
                    className="sm:w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatch({ type: "remove-spec", index: i })}
                    aria-label={`Remove spec ${i + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ── SEO ── */}
        <Card>
          <CardHeader className="border-b-2 border-line">
            <CardTitle>SEO</CardTitle>
          </CardHeader>
          <CardContent className="gap-4 p-6">
            <TextField
              label="Meta title"
              path="metaTitle"
              errors={fieldErrors}
              value={state.metaTitle}
              onChange={(e) =>
                dispatch({
                  type: "set-field",
                  field: "metaTitle",
                  value: e.target.value,
                })
              }
              placeholder="Raspberry Pi 5 — circuit.rocks"
            />
            <TextAreaField
              label="Meta description"
              path="metaDescription"
              errors={fieldErrors}
              value={state.metaDescription}
              onChange={(e) =>
                dispatch({
                  type: "set-field",
                  field: "metaDescription",
                  value: e.target.value,
                })
              }
              placeholder="Short search snippet…"
            />
          </CardContent>
        </Card>

        {/* ── Sticky action bar ── */}
        <div className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-line bg-paper shadow-[0_-4px_0_var(--line)]">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <span className="hidden items-center gap-2 font-mono text-[0.75rem] text-smoke sm:inline-flex">
              <Layers className="size-4" aria-hidden="true" />
              {variants.length} variant{variants.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-3">
              <Button asChild variant="secondary" size="md">
                <Link to="/products">Cancel</Link>
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={submitting}
              >
                {submitting ? "Creating…" : "Create product"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
