/**
 * circuit.rocks — dashboard feature: api layer.
 *
 * CANONICAL PATTERN for a feature's api file: import the shared `api` axios
 * instance + the feature's zod schemas, one async function per endpoint, parse
 * the response through its schema. No react/query here.
 *
 * The old SSR loader hit the `admin` god-module (`GET /admin/metrics`); the
 * backend split that into a per-domain module, so the new root is `GET /dashboard`.
 */

import { api } from "~/lib/axios";
import { dashboardSchema, type Dashboard } from "../types/dashboard.types";

/** GET /dashboard — KPIs, revenue series, status breakdown, low-stock, top + recent. */
export async function getDashboard(): Promise<Dashboard> {
  const res = await api.get("/dashboard");
  return dashboardSchema.parse(res.data);
}
