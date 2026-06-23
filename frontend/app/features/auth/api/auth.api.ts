/**
 * circuit.rocks — auth feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file: import the shared `api` axios
 * instance + the feature's zod schemas, one async function per endpoint, parse
 * the response through its schema. No react/query here.
 *
 * `meQueryOptions` is the canonical "who am I" query, reused by the auth context
 * provider, the `use-me` hook, and the router's `beforeLoad` guards (via
 * `queryClient.ensureQueryData(meQueryOptions)`). Defining it once with the v5
 * `queryOptions` helper keeps the query key + parsing consistent everywhere.
 */

import { queryOptions } from "@tanstack/react-query";

import { api } from "~/lib/axios";
import {
  authResponseSchema,
  meResponseSchema,
  type LoginInput,
  type RegisterInput,
  type User,
} from "../types/auth.types";

/** Fetch the current user, or `null` when unauthenticated (401). */
export async function getMe(): Promise<User | null> {
  try {
    const res = await api.get("/auth/me");
    return meResponseSchema.parse(res.data).user;
  } catch {
    // Any failure (incl. a 401 the interceptor couldn't refresh) → not signed in.
    return null;
  }
}

/** The shared `['me']` query. Imported by the context, hooks, and route guards. */
export const meQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: getMe,
  staleTime: 5 * 60 * 1000,
});

/** POST /auth/login — establishes the session (sets cookies); returns the user. */
export async function login(body: LoginInput): Promise<User> {
  const res = await api.post("/auth/login", body);
  return authResponseSchema.parse(res.data).user;
}

/** POST /auth/register — creates the account + session; returns the user. */
export async function register(body: RegisterInput): Promise<User> {
  const res = await api.post("/auth/register", body);
  return authResponseSchema.parse(res.data).user;
}

/** Clear the session server-side (POST /auth/logout). */
export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}
