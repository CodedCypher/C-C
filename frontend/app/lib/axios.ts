/**
 * circuit.rocks — the shared axios instance + auth interceptor.
 *
 * This is the client-side replacement for the old server-only cookie-proxy
 * (`api.server.ts`). The backend still owns auth via httpOnly cookies
 * (`cr_at` access 15m, `cr_rt` refresh 7d); the browser never reads them in JS.
 * Because `withCredentials: true`, the browser attaches those cookies to every
 * request and the backend rotates them via `Set-Cookie` automatically.
 *
 * TRANSPARENT REFRESH
 * -------------------
 * On a 401, a single response interceptor POSTs `/auth/refresh` ONCE (shared
 * across all in-flight 401s via a single-flight promise) and retries the
 * original request. If refresh fails, it redirects to `/login` and rejects.
 *
 * ERROR CONTRACT
 * --------------
 * `unwrapFieldErrors(error)` reproduces the `{ fieldErrors, formErrors }`
 * normalisation that `api.server.ts`'s `apiPost` did for 400/409 bodies, so
 * mutation hooks can map backend validation errors onto form fields/cells.
 */

import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

/**
 * Resolve a backend-served asset path (e.g. an uploaded proof image at
 * `/uploads/...`) to an absolute URL. The backend serves these on its own
 * origin (port 3000), not the SPA's, so root-relative paths must be prefixed
 * with the API base. Absolute URLs are returned unchanged.
 */
export function assetUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/* ------------------------------------------------------------------ *
 * Single-flight 401 → /auth/refresh → retry-once interceptor
 * ------------------------------------------------------------------ */

/** Marks a request config that has already been retried after a refresh. */
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/** Shared refresh promise so concurrent 401s trigger exactly one refresh. */
let refreshInFlight: Promise<void> | null = null;

/** Where to bounce on an unrecoverable auth failure. */
function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const here = window.location.pathname + window.location.search;
  // Don't loop if we're already on the login screen.
  if (window.location.pathname === "/login") return;
  window.location.assign(`/login?next=${encodeURIComponent(here)}`);
}

/** Fire (or join) the single in-flight refresh. */
function runRefresh(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = api
      .post("/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as RetryableConfig | undefined;

    // Only attempt recovery on a 401 with a known config, never retried before,
    // and never for the refresh call itself (that would recurse).
    const isRefreshCall = original?.url?.includes("/auth/refresh");
    if (status !== 401 || !original || original._retry || isRefreshCall) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      await runRefresh();
    } catch {
      // The `/auth/me` probe legitimately 401s for anonymous visitors on public
      // pages (storefront). Treat that as "not signed in" (caller catches → null)
      // instead of hard-redirecting them to /login. Only genuine protected-resource
      // calls bounce to login.
      const isMeProbe = original.url?.includes("/auth/me");
      if (!isMeProbe) redirectToLogin();
      return Promise.reject(error);
    }
    // Refresh rotated the cookies; replay the original request once.
    return api(original);
  },
);

/* ------------------------------------------------------------------ *
 * Error contract — reproduce api.server.ts apiPost's {fieldErrors, formErrors}
 * ------------------------------------------------------------------ */

/** Shape of an error body the backend may return on 400/409. */
interface ErrorBody {
  statusCode?: number;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  formErrors?: string[];
  // Nest's default ValidationPipe shape when fieldErrors/formErrors absent.
  message?: string[] | string;
}

/** The normalised validation error contract used across forms. */
export interface FieldErrorResult {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
}

/**
 * Normalise a 400/409 axios error into `{ fieldErrors, formErrors }`, mirroring
 * the parsing `api.server.ts`'s `apiPost` did server-side. Returns `null` for
 * anything that is NOT a 400/409 (network, 5xx, 401 already handled, etc.) so
 * callers can fall back to a generic error message.
 */
export function unwrapFieldErrors(error: unknown): FieldErrorResult | null {
  if (!axios.isAxiosError(error)) return null;
  const status = error.response?.status;
  if (status !== 400 && status !== 409) return null;

  const parsed = error.response?.data as ErrorBody | undefined;

  let fieldErrors: Record<string, string[]> = {};
  let formErrors: string[] = [];

  if (parsed?.fieldErrors || parsed?.formErrors) {
    fieldErrors = parsed.fieldErrors ?? {};
    formErrors = parsed.formErrors ?? [];
  } else if (parsed?.message != null) {
    // Normalise Nest's default `{ message: string[] | string }`.
    formErrors = Array.isArray(parsed.message)
      ? parsed.message
      : [parsed.message];
  } else {
    formErrors = ["Request failed. Please review the form and try again."];
  }

  return { fieldErrors, formErrors };
}
