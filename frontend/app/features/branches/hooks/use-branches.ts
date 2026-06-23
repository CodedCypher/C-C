/**
 * circuit.rocks — branches feature: list query hook.
 *
 * CANONICAL PATTERN for a list hook:
 *   - keep a `branchKeys` query-key factory so hooks + mutations agree on keys
 *   - wrap the api call in `useQuery`
 *
 * The list takes no params (the endpoint is unfiltered), so the key is static.
 */

import { useQuery } from "@tanstack/react-query";

import { getBranches } from "../api/branches.api";

export const branchKeys = {
  all: ["branches"] as const,
  list: () => ["branches", "list"] as const,
};

export function useBranches() {
  return useQuery({
    queryKey: branchKeys.list(),
    queryFn: () => getBranches(),
  });
}
