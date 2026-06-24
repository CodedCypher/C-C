/**
 * circuit.rocks — account feature: query + mutation hooks.
 *
 * Mirrors the canonical feature hook pattern: an `accountKeys` query-key factory
 * so reads + the profile mutation agree on keys, thin `useQuery` reads, and a
 * `useUpdateProfile` mutation that seeds the profile cache from its response.
 * `keepPreviousData` keeps the previous order-history page visible while
 * paginating.
 */

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import {
  getMyOrder,
  getMyOrders,
  getMyProfile,
  updateMyProfile,
  type MyOrdersParams,
} from "../api/account.api";
import type { ProfileInput } from "../types/account.types";

export const accountKeys = {
  all: ["account"] as const,
  profile: () => ["account", "profile"] as const,
  orders: (params: MyOrdersParams) => ["account", "orders", params] as const,
  order: (id: string) => ["account", "order", id] as const,
};

/* ----------------------------- Queries ----------------------------- */

/** The signed-in user's profile (GET /me/profile). */
export function useMyProfile() {
  return useQuery({
    queryKey: accountKeys.profile(),
    queryFn: () => getMyProfile(),
  });
}

/** Paginated order history (GET /me/orders). */
export function useMyOrders(params: MyOrdersParams) {
  return useQuery({
    queryKey: accountKeys.orders(params),
    queryFn: () => getMyOrders(params),
    placeholderData: keepPreviousData,
  });
}

/** A single order's read-only detail — disabled until `id` is present. */
export function useMyOrder(id: string) {
  return useQuery({
    queryKey: accountKeys.order(id),
    queryFn: () => getMyOrder(id),
    enabled: Boolean(id),
  });
}

/* ---------------------------- Mutations ---------------------------- */

/** Update the profile; seed the profile cache from the response. */
export function useUpdateProfile() {
  return useMutation({
    mutationFn: (body: ProfileInput) => updateMyProfile(body),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountKeys.profile(), profile);
    },
  });
}
