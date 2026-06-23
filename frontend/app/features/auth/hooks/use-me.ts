/**
 * circuit.rocks — auth feature: current-user query hook.
 *
 * Thin wrapper over `meQueryOptions` (re-exported so other features can import
 * either the hook or the raw options). The auth context is the usual consumer;
 * use this directly only when you need the `me` query outside the provider tree.
 */

import { useQuery } from "@tanstack/react-query";

import { meQueryOptions } from "../api/auth.api";

export { meQueryOptions };

export function useMe() {
  return useQuery(meQueryOptions);
}
