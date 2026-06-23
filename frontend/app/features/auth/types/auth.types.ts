/**
 * circuit.rocks — auth feature: zod schemas + inferred types.
 *
 * These schemas are the SINGLE SOURCE OF TRUTH for the auth domain. They mirror
 * the backend `/auth/me` response plus the login/register class-validator DTOs
 * (kept in sync by hand, no codegen). TS types come from `z.infer`.
 */

import { z } from "zod";

export const roleSchema = z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPERADMIN"]);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: roleSchema,
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  status: z.string().optional(),
});
export type User = z.infer<typeof userSchema>;

/** `GET /auth/me` returns `{ user }`. */
export const meResponseSchema = z.object({ user: userSchema });
export type MeResponse = z.infer<typeof meResponseSchema>;

/** `POST /auth/login` / `POST /auth/register` return `{ user }`. */
export const authResponseSchema = z.object({ user: userSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;

/* ------------------------------------------------------------------ *
 * Form DTOs (mirror the backend login/register class-validator DTOs)
 * ------------------------------------------------------------------ */

/** `POST /auth/login` body. */
export const loginSchema = z.object({
  email: z.string().min(1, "Enter your email").email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** `POST /auth/register` body. `firstName`/`lastName` optional (backend DTO). */
export const registerSchema = z.object({
  email: z.string().min(1, "Enter your email").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Staff = anyone allowed into the admin console. */
export function isStaff(role: Role): boolean {
  return role === "ADMIN" || role === "STAFF" || role === "SUPERADMIN";
}
