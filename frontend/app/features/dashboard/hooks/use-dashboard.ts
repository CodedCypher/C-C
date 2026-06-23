/**
 * circuit.rocks — dashboard feature: query hook.
 *
 * CANONICAL PATTERN for a single-resource query hook:
 *   - keep a `dashboardKeys` query-key factory so the hook + any future
 *     mutations/prefetch agree on the key
 *   - wrap the api call in `useQuery`; the page reads `{ data, isLoading, isError }`
 */

import { useQuery } from "@tanstack/react-query";

import { getDashboard } from "../api/dashboard.api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: getDashboard,
  });
}
