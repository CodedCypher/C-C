/**
 * circuit.rocks — storefront feature: query + mutation hooks.
 *
 * Mirrors the canonical feature hook pattern: a `storefrontKeys` factory, thin
 * `useQuery` reads, and `useMutation` writes that invalidate the cart key on
 * success (and DON'T swallow errors — the checkout page maps them via
 * `unwrapFieldErrors`). The cart lives under one key (`['storefront','cart']`)
 * so the nav badge, the drawer and the checkout page all share one cache entry.
 */

import { useMutation, useQuery } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import {
  addCartLine,
  checkout,
  createMyAddress,
  deleteBuild,
  deleteBuildChat,
  deleteMyAddress,
  getBarangays,
  getBranches,
  getBuild,
  getBuildChat,
  getBuildChats,
  getCart,
  getCityMun,
  getFeaturedProducts,
  getMyAddresses,
  getMyBuilds,
  getPaymentMethods,
  getProduct,
  getProject,
  getProjects,
  getProvinces,
  getRegions,
  removeCartLine,
  resolveBuild,
  resolveBuildImage,
  resolveBuildUrl,
  sendBuildChat,
  setDefaultMyAddress,
  updateCartLine,
  updateMyAddress,
  type SendBuildChatArgs,
} from "../api/storefront.api";
import type {
  BuildChatDetail,
  Cart,
  CreateAddressInput,
  SendBuildChatResponse,
  UpdateAddressInput,
} from "../types/storefront.types";

export const storefrontKeys = {
  all: ["storefront"] as const,
  featured: () => ["storefront", "featured"] as const,
  product: (slug: string) => ["storefront", "product", slug] as const,
  projects: () => ["storefront", "projects"] as const,
  project: (slug: string) => ["storefront", "project", slug] as const,
  build: (id: string) => ["storefront", "build", id] as const,
  myBuilds: () => ["storefront", "my-builds"] as const,
  buildChats: () => ["storefront", "build-chats"] as const,
  buildChat: (id: string) => ["storefront", "build-chat", id] as const,
  cart: () => ["storefront", "cart"] as const,
  regions: () => ["storefront", "regions"] as const,
  provinces: (regCode: string) =>
    ["storefront", "provinces", regCode] as const,
  cityMun: (provCode: string) => ["storefront", "citymun", provCode] as const,
  barangays: (citymunCode: string) =>
    ["storefront", "barangays", citymunCode] as const,
  branches: () => ["storefront", "branches"] as const,
  paymentMethods: () => ["storefront", "payment-methods"] as const,
  myAddresses: () => ["storefront", "my-addresses"] as const,
};

/* ----------------------------- Queries ----------------------------- */

export function useFeaturedProducts(limit?: number) {
  return useQuery({
    queryKey: [...storefrontKeys.featured(), limit ?? null],
    queryFn: () => getFeaturedProducts(limit),
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: storefrontKeys.product(slug),
    queryFn: () => getProduct(slug),
    enabled: Boolean(slug),
  });
}

export function useProjects() {
  return useQuery({
    queryKey: storefrontKeys.projects(),
    queryFn: () => getProjects(),
  });
}

export function useProject(slug: string) {
  return useQuery({
    queryKey: storefrontKeys.project(slug),
    queryFn: () => getProject(slug),
    enabled: Boolean(slug),
  });
}

export function useCart() {
  return useQuery({
    queryKey: storefrontKeys.cart(),
    queryFn: () => getCart(),
  });
}

/** A saved build by id (re-resolved server-side with fresh stock). */
export function useBuild(id: string) {
  return useQuery({
    queryKey: storefrontKeys.build(id),
    queryFn: () => getBuild(id),
    enabled: Boolean(id),
  });
}

/** The caller's saved builds ("My builds"); works for guests via the cart cookie. */
export function useMyBuilds() {
  return useQuery({
    queryKey: storefrontKeys.myBuilds(),
    queryFn: () => getMyBuilds(),
  });
}

/** Seed the detail cache + refresh the list so a new build renders instantly. */
function onBuildResolved(build: { id: string }) {
  queryClient.setQueryData(storefrontKeys.build(build.id), build);
  queryClient.invalidateQueries({ queryKey: storefrontKeys.myBuilds() });
}

/** Resolve a pasted parts list into a persisted, shareable build. */
export function useResolveBuild() {
  return useMutation({
    mutationFn: (text: string) => resolveBuild(text),
    onSuccess: onBuildResolved,
  });
}

/** Resolve a tutorial/blog link into a persisted, shareable build. */
export function useResolveBuildUrl() {
  return useMutation({
    mutationFn: (url: string) => resolveBuildUrl(url),
    onSuccess: onBuildResolved,
  });
}

/** Resolve a schematic / breadboard / printed-BOM photo into a build. */
export function useResolveBuildImage() {
  return useMutation({
    mutationFn: (file: File) => resolveBuildImage(file),
    onSuccess: onBuildResolved,
  });
}

/** Delete one of the caller's saved builds. */
export function useDeleteBuild() {
  return useMutation({
    mutationFn: (id: string) => deleteBuild(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storefrontKeys.myBuilds() });
    },
  });
}

/* ----------------------------- Build chat ----------------------------- */

/** The caller's build-assistant chats (history rail). */
export function useBuildChats() {
  return useQuery({
    queryKey: storefrontKeys.buildChats(),
    queryFn: () => getBuildChats(),
  });
}

/** One chat with its full message log (re-resolved inline builds). */
export function useBuildChat(id: string | undefined) {
  return useQuery({
    queryKey: storefrontKeys.buildChat(id ?? ""),
    queryFn: () => getBuildChat(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Send one chat turn. Appends the user + assistant messages to the chat-detail
 * cache so the thread updates instantly, refreshes the history rail, and (when a
 * build was resolved) the "my builds" list.
 */
export function useSendBuildChat() {
  return useMutation({
    mutationFn: (args: SendBuildChatArgs) => sendBuildChat(args),
    onSuccess: (res: SendBuildChatResponse) => {
      queryClient.setQueryData<BuildChatDetail>(
        storefrontKeys.buildChat(res.chat.id),
        (prev) => {
          const base = prev ?? { ...res.chat, messages: [] };
          return {
            ...base,
            ...res.chat,
            messages: [...base.messages, res.userMessage, res.assistantMessage],
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: storefrontKeys.buildChats() });
      if (res.build) {
        queryClient.invalidateQueries({ queryKey: storefrontKeys.myBuilds() });
      }
    },
  });
}

/** Delete one of the caller's chats. */
export function useDeleteBuildChat() {
  return useMutation({
    mutationFn: (id: string) => deleteBuildChat(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: storefrontKeys.buildChats() });
      queryClient.removeQueries({
        queryKey: storefrontKeys.buildChat(res.id),
      });
    },
  });
}

/* --- Cascading PH address dropdowns (each enabled once its parent is set) --- */

export function useRegions() {
  return useQuery({
    queryKey: storefrontKeys.regions(),
    queryFn: () => getRegions(),
    staleTime: Infinity,
  });
}

export function useProvinces(regCode: string | undefined) {
  return useQuery({
    queryKey: storefrontKeys.provinces(regCode ?? ""),
    queryFn: () => getProvinces(regCode as string),
    enabled: Boolean(regCode),
    staleTime: Infinity,
  });
}

export function useCityMun(provCode: string | undefined) {
  return useQuery({
    queryKey: storefrontKeys.cityMun(provCode ?? ""),
    queryFn: () => getCityMun(provCode as string),
    enabled: Boolean(provCode),
    staleTime: Infinity,
  });
}

export function useBarangays(citymunCode: string | undefined) {
  return useQuery({
    queryKey: storefrontKeys.barangays(citymunCode ?? ""),
    queryFn: () => getBarangays(citymunCode as string),
    enabled: Boolean(citymunCode),
    staleTime: Infinity,
  });
}

export function useBranches() {
  return useQuery({
    queryKey: storefrontKeys.branches(),
    queryFn: () => getBranches(),
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: storefrontKeys.paymentMethods(),
    queryFn: () => getPaymentMethods(),
  });
}

/** The signed-in user's saved addresses (pass `enabled` = is-authenticated). */
export function useMyAddresses(enabled: boolean) {
  return useQuery({
    queryKey: storefrontKeys.myAddresses(),
    queryFn: () => getMyAddresses(),
    enabled,
  });
}

/* ---------------------------- Mutations ---------------------------- */

/** Seed the cart cache from a mutation response so the UI updates instantly. */
function writeCart(cart: Cart) {
  queryClient.setQueryData(storefrontKeys.cart(), cart);
}

export function useAddToCart() {
  return useMutation({
    mutationFn: ({
      variantId,
      quantity,
    }: {
      variantId: string;
      quantity: number;
    }) => addCartLine(variantId, quantity),
    onSuccess: writeCart,
  });
}

export function useUpdateCartLine() {
  return useMutation({
    mutationFn: ({
      variantId,
      quantity,
    }: {
      variantId: string;
      quantity: number;
    }) => updateCartLine(variantId, quantity),
    onSuccess: writeCart,
  });
}

export function useRemoveCartLine() {
  return useMutation({
    mutationFn: (variantId: string) => removeCartLine(variantId),
    onSuccess: writeCart,
  });
}

/** Create + select a saved delivery address for the signed-in shopper. */
export function useCreateAddress() {
  return useMutation({
    mutationFn: (body: CreateAddressInput) => createMyAddress(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storefrontKeys.myAddresses() });
    },
  });
}

/** Update an existing saved address (partial body). */
export function useUpdateAddress() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAddressInput }) =>
      updateMyAddress(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storefrontKeys.myAddresses() });
    },
  });
}

/** Delete a saved address. */
export function useDeleteAddress() {
  return useMutation({
    mutationFn: (id: string) => deleteMyAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storefrontKeys.myAddresses() });
    },
  });
}

/** Mark a saved address as the default delivery address. */
export function useSetDefaultAddress() {
  return useMutation({
    mutationFn: (id: string) => setDefaultMyAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storefrontKeys.myAddresses() });
    },
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (form: FormData) => checkout(form),
    onSuccess: () => {
      // Cart was converted server-side; drop the stale cache.
      queryClient.invalidateQueries({ queryKey: storefrontKeys.cart() });
    },
  });
}
