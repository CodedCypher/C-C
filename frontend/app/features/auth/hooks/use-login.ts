/**
 * circuit.rocks — auth feature: login mutation.
 *
 * POSTs `/auth/login` (the backend sets the httpOnly cookies), refreshes the
 * `['me']` query so the auth context picks up the new user, then navigates to
 * the post-login target (`next` if provided, else `/`).
 *
 * CANONICAL PATTERN for an auth mutation hook: take the redirect target from the
 * caller (the page reads it from the router search params), invalidate `['me']`,
 * and let errors propagate so the page can map `unwrapFieldErrors` onto fields.
 */

import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { queryClient } from "~/lib/query-client";
import { login } from "../api/auth.api";
import { meQueryOptions } from "../api/auth.api";

export function useLogin(next?: string) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey });
      navigate({ to: next && next.startsWith("/") ? next : "/" });
    },
  });
}
