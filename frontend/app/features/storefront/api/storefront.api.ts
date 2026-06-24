/**
 * circuit.rocks — storefront feature: api layer (the storefront's first real
 * backend calls). Pure data access against the PUBLIC `/storefront/*` endpoints;
 * every response is `.parse()`d through a zod schema. The shared `api` axios
 * instance already sends `withCredentials: true`, so the guest-cart `cr_cart`
 * cookie rides along automatically.
 */

import { z } from "zod";

import { api } from "~/lib/axios";
import {
  branchSummarySchema,
  buildChatDetailSchema,
  buildChatListSchema,
  buildDetailSchema,
  buildSummarySchema,
  cartSchema,
  sendBuildChatResponseSchema,
  checkoutResultSchema,
  paymentMethodSchema,
  productDetailSchema,
  productSummarySchema,
  projectDetailSchema,
  projectSummarySchema,
  refOptionSchema,
  savedAddressSchema,
  type BranchSummary,
  type BuildChatDetail,
  type BuildChatMode,
  type BuildChatSummary,
  type BuildDetail,
  type Cart,
  type SendBuildChatResponse,
  type CheckoutResult,
  type CreateAddressInput,
  type PaymentMethod,
  type ProductDetail,
  type ProductSummary,
  type ProjectDetail,
  type ProjectSummary,
  type BuildSummary,
  type RefOption,
  type SavedAddress,
  type UpdateAddressInput,
} from "../types/storefront.types";

const productListSchema = z.array(productSummarySchema);
const projectListSchema = z.array(projectSummarySchema);
const buildListSchema = z.array(buildSummarySchema);
const refListSchema = z.array(refOptionSchema);
const branchListSchema = z.array(branchSummarySchema);
const paymentMethodListSchema = z.array(paymentMethodSchema);
const savedAddressListSchema = z.array(savedAddressSchema);

/** GET /storefront/products — a few ACTIVE products for the home grid. */
export async function getFeaturedProducts(
  limit?: number,
): Promise<ProductSummary[]> {
  const res = await api.get("/storefront/products", {
    params: limit ? { limit } : undefined,
  });
  return productListSchema.parse(res.data);
}

/** GET /storefront/products/:slug — full PDP detail. */
export async function getProduct(slug: string): Promise<ProductDetail> {
  const res = await api.get(`/storefront/products/${slug}`);
  return productDetailSchema.parse(res.data);
}

/** GET /storefront/projects — curated buildable kits (BOM-resolved). */
export async function getProjects(): Promise<ProjectSummary[]> {
  const res = await api.get("/storefront/projects");
  return projectListSchema.parse(res.data);
}

/** GET /storefront/projects/:slug — a kit + its resolved, stock-checked parts. */
export async function getProject(slug: string): Promise<ProjectDetail> {
  const res = await api.get(`/storefront/projects/${slug}`);
  return projectDetailSchema.parse(res.data);
}

/** POST /storefront/builds/resolve — resolve a pasted parts list into a saved build. */
export async function resolveBuild(text: string): Promise<BuildDetail> {
  const res = await api.post("/storefront/builds/resolve", { text });
  return buildDetailSchema.parse(res.data);
}

/** POST /storefront/builds/resolve — resolve a tutorial/blog link into a saved build. */
export async function resolveBuildUrl(url: string): Promise<BuildDetail> {
  const res = await api.post("/storefront/builds/resolve", { url });
  return buildDetailSchema.parse(res.data);
}

/** POST /storefront/builds/resolve-image — resolve a schematic/BOM photo (multipart). */
export async function resolveBuildImage(file: File): Promise<BuildDetail> {
  const form = new FormData();
  form.append("image", file);
  const res = await api.post("/storefront/builds/resolve-image", form);
  return buildDetailSchema.parse(res.data);
}

/** GET /storefront/builds/:id — a saved build, re-resolved with fresh stock. */
export async function getBuild(id: string): Promise<BuildDetail> {
  const res = await api.get(`/storefront/builds/${id}`);
  return buildDetailSchema.parse(res.data);
}

/** GET /storefront/builds — the caller's saved builds (by user, else cookie). */
export async function getMyBuilds(): Promise<BuildSummary[]> {
  const res = await api.get("/storefront/builds");
  return buildListSchema.parse(res.data);
}

/** DELETE /storefront/builds/:id — remove one of the caller's saved builds. */
export async function deleteBuild(id: string): Promise<{ id: string }> {
  const res = await api.delete(`/storefront/builds/${id}`);
  return z.object({ id: z.string() }).parse(res.data);
}

/* ----------------------------- Build chat ----------------------------- */

export interface SendBuildChatArgs {
  chatId?: string;
  mode: BuildChatMode;
  text?: string;
  url?: string;
  image?: File;
}

/**
 * POST /storefront/build-chats — send one turn. Multipart when an `image` is
 * attached (the photo door), else a JSON body. Lazy-creates the chat when
 * `chatId` is omitted; the response carries the new chat id.
 */
export async function sendBuildChat(
  args: SendBuildChatArgs,
): Promise<SendBuildChatResponse> {
  let res;
  if (args.image) {
    const form = new FormData();
    form.append("mode", args.mode);
    if (args.chatId) form.append("chatId", args.chatId);
    if (args.text) form.append("text", args.text);
    if (args.url) form.append("url", args.url);
    form.append("image", args.image);
    res = await api.post("/storefront/build-chats", form);
  } else {
    res = await api.post("/storefront/build-chats", {
      mode: args.mode,
      chatId: args.chatId,
      text: args.text,
      url: args.url,
    });
  }
  return sendBuildChatResponseSchema.parse(res.data);
}

/** GET /storefront/build-chats — the caller's chats (newest first). */
export async function getBuildChats(): Promise<BuildChatSummary[]> {
  const res = await api.get("/storefront/build-chats");
  return buildChatListSchema.parse(res.data);
}

/** GET /storefront/build-chats/:id — one chat with its full message log. */
export async function getBuildChat(id: string): Promise<BuildChatDetail> {
  const res = await api.get(`/storefront/build-chats/${id}`);
  return buildChatDetailSchema.parse(res.data);
}

/** DELETE /storefront/build-chats/:id — remove one of the caller's chats. */
export async function deleteBuildChat(id: string): Promise<{ id: string }> {
  const res = await api.delete(`/storefront/build-chats/${id}`);
  return z.object({ id: z.string() }).parse(res.data);
}

/** GET /storefront/cart — current guest cart. */
export async function getCart(): Promise<Cart> {
  const res = await api.get("/storefront/cart");
  return cartSchema.parse(res.data);
}

/** POST /storefront/cart/lines — add a variant; backend sets the cart cookie. */
export async function addCartLine(
  variantId: string,
  quantity: number,
): Promise<Cart> {
  const res = await api.post("/storefront/cart/lines", { variantId, quantity });
  return cartSchema.parse(res.data);
}

/** PATCH /storefront/cart/lines/:variantId — set quantity (0 removes). */
export async function updateCartLine(
  variantId: string,
  quantity: number,
): Promise<Cart> {
  const res = await api.patch(`/storefront/cart/lines/${variantId}`, {
    quantity,
  });
  return cartSchema.parse(res.data);
}

/** DELETE /storefront/cart/lines/:variantId — remove a line. */
export async function removeCartLine(variantId: string): Promise<Cart> {
  const res = await api.delete(`/storefront/cart/lines/${variantId}`);
  return cartSchema.parse(res.data);
}

/* ----- Cascading PH address dropdowns ----- */

/** GET /storefront/address/regions */
export async function getRegions(): Promise<RefOption[]> {
  const res = await api.get("/storefront/address/regions");
  return refListSchema.parse(res.data);
}

/** GET /storefront/address/provinces?regCode= */
export async function getProvinces(regCode: string): Promise<RefOption[]> {
  const res = await api.get("/storefront/address/provinces", {
    params: { regCode },
  });
  return refListSchema.parse(res.data);
}

/** GET /storefront/address/citymun?provCode= */
export async function getCityMun(provCode: string): Promise<RefOption[]> {
  const res = await api.get("/storefront/address/citymun", {
    params: { provCode },
  });
  return refListSchema.parse(res.data);
}

/** GET /storefront/address/barangays?citymunCode= */
export async function getBarangays(citymunCode: string): Promise<RefOption[]> {
  const res = await api.get("/storefront/address/barangays", {
    params: { citymunCode },
  });
  return refListSchema.parse(res.data);
}

/* ----- Pickup branches + payment methods ----- */

/** GET /storefront/branches — active branches for pickup. */
export async function getBranches(): Promise<BranchSummary[]> {
  const res = await api.get("/storefront/branches");
  return branchListSchema.parse(res.data);
}

/** GET /storefront/payment-methods — active, admin-managed methods. */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const res = await api.get("/storefront/payment-methods");
  return paymentMethodListSchema.parse(res.data);
}

/* ----- Saved addresses (signed-in only; guarded by auth cookie) ----- */

/** GET /addresses — the current user's saved delivery addresses. */
export async function getMyAddresses(): Promise<SavedAddress[]> {
  const res = await api.get("/addresses");
  return savedAddressListSchema.parse(res.data);
}

/** POST /addresses — save a new delivery address for the current user. */
export async function createMyAddress(
  body: CreateAddressInput,
): Promise<SavedAddress> {
  const res = await api.post("/addresses", body);
  return savedAddressSchema.parse(res.data);
}

/** PATCH /addresses/:id — update an existing saved address (partial body). */
export async function updateMyAddress(
  id: string,
  body: UpdateAddressInput,
): Promise<SavedAddress> {
  const res = await api.patch(`/addresses/${id}`, body);
  return savedAddressSchema.parse(res.data);
}

/** DELETE /addresses/:id — remove a saved address. */
export async function deleteMyAddress(id: string): Promise<{ id: string }> {
  const res = await api.delete(`/addresses/${id}`);
  return z.object({ id: z.string() }).parse(res.data);
}

/** PATCH /addresses/:id/default — mark a saved address as the default. */
export async function setDefaultMyAddress(id: string): Promise<SavedAddress> {
  const res = await api.patch(`/addresses/${id}/default`);
  return savedAddressSchema.parse(res.data);
}

/**
 * POST /storefront/checkout — atomic multipart checkout (proof file + fields).
 * Creates a PENDING Order + PENDING Payment. The caller builds the FormData.
 */
export async function checkout(form: FormData): Promise<CheckoutResult> {
  const res = await api.post("/storefront/checkout", form);
  return checkoutResultSchema.parse(res.data);
}
