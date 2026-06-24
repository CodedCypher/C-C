/**
 * circuit.rocks — account feature: api layer.
 *
 * Pure data access against the customer-facing `/me/*` endpoints; every response
 * is `.parse()`d through a zod schema so callers get runtime-validated data. The
 * shared `api` axios instance already sends `withCredentials: true`, so the auth
 * cookie rides along automatically (these endpoints require a signed-in user).
 */

import { api } from "~/lib/axios";
import { type Paginated } from "~/lib/pagination";
import {
  myOrderDetailSchema,
  myOrdersSchema,
  profileSchema,
  type MyOrderDetail,
  type MyOrderRow,
  type Profile,
  type ProfileInput,
} from "../types/account.types";

export interface MyOrdersParams {
  page?: number;
  take?: number;
}

/** GET /me/profile — the signed-in user's profile. */
export async function getMyProfile(): Promise<Profile> {
  const res = await api.get("/me/profile");
  return profileSchema.parse(res.data);
}

/** PATCH /me/profile — update editable profile fields; returns the profile. */
export async function updateMyProfile(body: ProfileInput): Promise<Profile> {
  const res = await api.patch("/me/profile", body);
  return profileSchema.parse(res.data);
}

/** GET /me/orders — paginated, read-only order history. */
export async function getMyOrders(
  params: MyOrdersParams,
): Promise<Paginated<MyOrderRow>> {
  const res = await api.get("/me/orders", { params });
  return myOrdersSchema.parse(res.data);
}

/** GET /me/orders/:id — full read-only detail for one of the user's orders. */
export async function getMyOrder(id: string): Promise<MyOrderDetail> {
  const res = await api.get(`/me/orders/${id}`);
  return myOrderDetailSchema.parse(res.data);
}
