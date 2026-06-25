/**
 * circuit.rocks — storefront feature: zod schemas + inferred types.
 *
 * The storefront was historically static; these are its FIRST real data
 * contracts. They are the SINGLE SOURCE OF TRUTH for the public PDP + guest
 * cart + checkout, mirroring the backend `storefront` module's response shapes
 * (`GET/POST /storefront/*`). Every api call `.parse()`s through them.
 */

import { z } from "zod";

/** Web availability per variant, derived from the default-web warehouse. */
export const stockStateSchema = z.enum(["IN_STOCK", "LOW", "OUT"]);
export type StockState = z.infer<typeof stockStateSchema>;

/* ------------------------------------------------------------------ *
 * Product summary (GET /storefront/products) — home cards
 * ------------------------------------------------------------------ */

export const productSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  brand: z.string().nullable(),
  priceMin: z.number(),
  priceMax: z.number(),
  primaryImage: z.string().nullable(),
  availability: stockStateSchema,
});
export type ProductSummary = z.infer<typeof productSummarySchema>;

/* ------------------------------------------------------------------ *
 * Product detail (GET /storefront/products/:slug)
 * ------------------------------------------------------------------ */

export const productImageSchema = z.object({
  url: z.string(),
  alt: z.string().nullable(),
  isPrimary: z.boolean(),
});

export const optionTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  values: z.array(z.object({ id: z.string(), value: z.string() })),
});

export const storefrontVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  title: z.string().nullable(),
  price: z.number(),
  compareAtPrice: z.number().nullable(),
  optionValueIds: z.array(z.string()),
  availability: stockStateSchema,
});
export type StorefrontVariant = z.infer<typeof storefrontVariantSchema>;

export const specGroupSchema = z.object({
  group: z.string().nullable(),
  items: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      unit: z.string().nullable(),
    }),
  ),
});

export const productDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  brand: z.string().nullable(),
  priceMin: z.number(),
  priceMax: z.number(),
  images: z.array(productImageSchema),
  optionTypes: z.array(optionTypeSchema),
  variants: z.array(storefrontVariantSchema),
  specGroups: z.array(specGroupSchema),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

/* ------------------------------------------------------------------ *
 * Cart (GET/POST/PATCH/DELETE /storefront/cart*)
 * ------------------------------------------------------------------ */

export const cartLineSchema = z.object({
  variantId: z.string(),
  sku: z.string(),
  name: z.string(),
  productSlug: z.string(),
  image: z.string().nullable(),
  unitPrice: z.number(),
  quantity: z.number(),
  lineTotal: z.number(),
});
export type CartLine = z.infer<typeof cartLineSchema>;

export const cartSchema = z.object({
  currency: z.string(),
  lines: z.array(cartLineSchema),
  subtotal: z.number(),
  count: z.number(),
});
export type Cart = z.infer<typeof cartSchema>;

/* ------------------------------------------------------------------ *
 * Checkout reference data — cascading PH address, branches, payment methods
 * ------------------------------------------------------------------ */

/** A cascading-dropdown option (GET /storefront/address/*). */
export const refOptionSchema = z.object({
  code: z.string(),
  name: z.string(),
});
export type RefOption = z.infer<typeof refOptionSchema>;

/** A branch offered as a pickup option (GET /storefront/branches). */
export const branchSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  phone: z.string().nullable(),
});
export type BranchSummary = z.infer<typeof branchSummarySchema>;

/** An admin-managed payment method (GET /storefront/payment-methods). */
export const paymentMethodSchema = z.object({
  id: z.string(),
  name: z.string(),
  instructions: z.string().nullable(),
  qrImageUrl: z.string().nullable(),
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/** A signed-in shopper's saved delivery address (GET/POST /addresses). */
export const savedAddressSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  line1: z.string(),
  line2: z.string().nullable(),
  barangay: z.string().nullable(),
  city: z.string(),
  province: z.string().nullable(),
  region: z.string(),
  postalCode: z.string(),
  country: z.string(),
  regionCode: z.string().nullable(),
  provinceCode: z.string().nullable(),
  cityCode: z.string().nullable(),
  barangayCode: z.string().nullable(),
  isDefault: z.boolean(),
});
export type SavedAddress = z.infer<typeof savedAddressSchema>;

/** Body for POST /addresses (create a saved delivery address). */
export const createAddressSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(1).max(40),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  barangay: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
  province: z.string().min(1).max(120),
  region: z.string().min(1).max(120),
  postalCode: z.string().min(1).max(20),
  country: z.string().max(120).optional(),
  regionCode: z.string().optional(),
  provinceCode: z.string().optional(),
  cityCode: z.string().optional(),
  barangayCode: z.string().optional(),
  isDefault: z.boolean().optional(),
});
export type CreateAddressInput = z.infer<typeof createAddressSchema>;

/** Body for PATCH /addresses/:id — every create field, all optional. */
export const updateAddressSchema = createAddressSchema.partial();
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

/* ------------------------------------------------------------------ *
 * Checkout result (POST /storefront/checkout — multipart)
 * ------------------------------------------------------------------ */

export const fulfillmentTypeSchema = z.enum(["DELIVERY", "PICKUP"]);
export type FulfillmentType = z.infer<typeof fulfillmentTypeSchema>;

export const checkoutResultSchema = z.object({
  orderNumber: z.string(),
  grandTotal: z.number(),
});
export type CheckoutResult = z.infer<typeof checkoutResultSchema>;

/* ------------------------------------------------------------------ *
 * Projects — buildable kits resolved from a BOM (GET /storefront/projects[/:slug])
 * ------------------------------------------------------------------ */

/** A buildable kit in the projects index. */
export const projectSummarySchema = z.object({
  slug: z.string(),
  variantId: z.string(),
  title: z.string(),
  primaryImage: z.string().nullable(),
  partCount: z.number(),
  inStockCount: z.number(),
  estimatedTotal: z.number(),
  allInStock: z.boolean(),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

/** A single BOM-resolved, purchasable, stock-checked component of a kit. */
export const projectPartSchema = z.object({
  variantId: z.string(),
  productSlug: z.string(),
  sku: z.string(),
  title: z.string(),
  image: z.string().nullable(),
  unit: z.string(),
  requiredQty: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  available: z.number(),
  availability: stockStateSchema,
  purchasable: z.boolean(),
  canAdd: z.boolean(),
});
export type ProjectPart = z.infer<typeof projectPartSchema>;

export const projectDetailSchema = z.object({
  slug: z.string(),
  variantId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  primaryImage: z.string().nullable(),
  assembledPrice: z.number(),
  parts: z.array(projectPartSchema),
  partCount: z.number(),
  inStockCount: z.number(),
  estimatedTotal: z.number(),
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

/* ------------------------------------------------------------------ *
 * Availability → display label + Badge variant
 * ------------------------------------------------------------------ */

export const AVAILABILITY_META: Record<
  StockState,
  { label: string; variant: "stock" | "signal" | "soldout" }
> = {
  IN_STOCK: { label: "In stock", variant: "stock" },
  LOW: { label: "Low stock", variant: "signal" },
  OUT: { label: "Sold out", variant: "soldout" },
};

/* ------------------------------------------------------------------ *
 * Builds — maker inspiration resolved into catalog parts
 * (POST /storefront/builds/resolve, GET /storefront/builds/:id).
 * A build reuses the project-part shape + per-line matcher metadata;
 * lines with no catalog match are surfaced separately as `unmatched`.
 * ------------------------------------------------------------------ */

export const buildSourceSchema = z.enum(["TEXT", "URL", "IMAGE"]);
export type BuildSource = z.infer<typeof buildSourceSchema>;

export const buildLineStatusSchema = z.enum([
  "MATCHED",
  "SUBSTITUTED",
  "LOW_CONFIDENCE",
  "OUT_OF_STOCK",
  "UNMATCHED",
]);
export type BuildLineStatus = z.infer<typeof buildLineStatusSchema>;

/** A resolved alternative the shopper can swap to. */
export const buildAlternativeSchema = z.object({
  variantId: z.string(),
  productSlug: z.string(),
  sku: z.string(),
  title: z.string(),
  image: z.string().nullable(),
  unitPrice: z.number(),
  available: z.number(),
  availability: stockStateSchema,
  canAdd: z.boolean(),
});
export type BuildAlternative = z.infer<typeof buildAlternativeSchema>;

export const buildPartSchema = projectPartSchema.extend({
  lineId: z.string(),
  rawLabel: z.string(),
  confidence: z.number(),
  note: z.string().nullable(),
  status: buildLineStatusSchema,
  // Set when the active variant is an auto-swap from an out-of-stock primary.
  swappedFrom: z.object({ rawLabel: z.string(), title: z.string() }).nullable(),
  alternatives: z.array(buildAlternativeSchema),
});
export type BuildPart = z.infer<typeof buildPartSchema>;

export const buildUnmatchedLineSchema = z.object({
  rawLabel: z.string(),
  requiredQty: z.number(),
  note: z.string().nullable(),
  status: z.literal("UNMATCHED"),
});
export type BuildUnmatchedLine = z.infer<typeof buildUnmatchedLineSchema>;

export const buildDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  sourceType: buildSourceSchema,
  parts: z.array(buildPartSchema),
  unmatched: z.array(buildUnmatchedLineSchema),
  partCount: z.number(),
  inStockCount: z.number(),
  estimatedTotal: z.number(),
  createdAt: z.string(),
});
export type BuildDetail = z.infer<typeof buildDetailSchema>;

/** A "My builds" list row (GET /storefront/builds). */
export const buildSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  sourceType: buildSourceSchema,
  partCount: z.number(),
  createdAt: z.string(),
});
export type BuildSummary = z.infer<typeof buildSummarySchema>;

/** Per-source display label + icon hint (build provenance chip). */
export const BUILD_SOURCE_META: Record<
  BuildSource,
  { label: string; icon: "text" | "link" | "image" }
> = {
  TEXT: { label: "Parts list", icon: "text" },
  URL: { label: "From a link", icon: "link" },
  IMAGE: { label: "From a photo", icon: "image" },
};

/** Per-status display label + Badge variant (build parts list). */
export const BUILD_STATUS_META: Record<
  BuildLineStatus,
  { label: string; variant: "stock" | "signal" | "soldout" }
> = {
  MATCHED: { label: "Matched", variant: "stock" },
  SUBSTITUTED: { label: "Substituted", variant: "signal" },
  LOW_CONFIDENCE: { label: "Low confidence", variant: "signal" },
  OUT_OF_STOCK: { label: "Out of stock", variant: "soldout" },
  UNMATCHED: { label: "No match", variant: "soldout" },
};

/* ------------------------------------------------------------------ *
 * Build assistant — conversational chat (POST /storefront/build-chats)
 * ------------------------------------------------------------------ */

export const buildChatModeSchema = z.enum(["BRAINSTORM", "GRILL", "IMPECCABLE"]);
export type BuildChatMode = z.infer<typeof buildChatModeSchema>;

export const buildChatRoleSchema = z.enum(["USER", "ASSISTANT"]);
export type BuildChatRole = z.infer<typeof buildChatRoleSchema>;

/** One turn; an assistant turn that resolved parts carries a `build` card. */
export const buildChatMessageSchema = z.object({
  id: z.string(),
  role: buildChatRoleSchema,
  content: z.string(),
  /** Root-relative URL of an attached photo (build-from-photo door). */
  imageUrl: z.string().nullable().optional(),
  build: buildDetailSchema.nullable(),
  createdAt: z.string(),
});
export type BuildChatMessage = z.infer<typeof buildChatMessageSchema>;

export const buildChatSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  mode: buildChatModeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number(),
});
export type BuildChatSummary = z.infer<typeof buildChatSummarySchema>;

export const buildChatListSchema = z.array(buildChatSummarySchema);

export const buildChatDetailSchema = buildChatSummarySchema.extend({
  messages: z.array(buildChatMessageSchema),
});
export type BuildChatDetail = z.infer<typeof buildChatDetailSchema>;

/** The response from sending one turn (POST /storefront/build-chats). */
export const sendBuildChatResponseSchema = z.object({
  chat: buildChatSummarySchema,
  userMessage: buildChatMessageSchema,
  assistantMessage: buildChatMessageSchema,
  build: buildDetailSchema.nullable(),
});
export type SendBuildChatResponse = z.infer<typeof sendBuildChatResponseSchema>;

/** UI metadata for the three modes — labels + the slash-command that selects them. */
export const BUILD_CHAT_MODE_META: Record<
  BuildChatMode,
  { label: string; command: string; blurb: string }
> = {
  BRAINSTORM: {
    label: "Brainstorm",
    command: "/brainstorming",
    blurb: "Figure out what to build",
  },
  GRILL: {
    label: "Grill me",
    command: "/grill-me",
    blurb: "Pressure-test the idea",
  },
  IMPECCABLE: {
    label: "Perfect it",
    command: "/impeccable",
    blurb: "Polish the parts list",
  },
};

/** Map a typed slash-command back to its mode (for the composer). */
export const SLASH_COMMAND_TO_MODE: Record<string, BuildChatMode> = {
  "/brainstorming": "BRAINSTORM",
  "/brainstorm": "BRAINSTORM",
  "/grill-me": "GRILL",
  "/grill": "GRILL",
  "/impeccable": "IMPECCABLE",
  "/perfect": "IMPECCABLE",
};
