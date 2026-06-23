/**
 * circuit.rocks — the single shared TanStack Query client.
 *
 * Imported by `main.tsx` (the provider), by feature mutation hooks (to invalidate
 * queries), and by the router's `beforeLoad` guards (via `ensureQueryData`).
 * `retry: false` because our axios interceptor already handles the one retry
 * that matters (401 → refresh → retry); anything else should surface fast.
 */

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});
