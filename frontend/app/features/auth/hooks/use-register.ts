/**
 * circuit.rocks — auth feature: register mutation.
 *
 * POSTs `/auth/register` (the backend creates the account + session and sets the
 * httpOnly cookies), refreshes the `['me']` query, then navigates to the
 * post-register target (`next` if provided, else `/`). Mirrors `use-login`.
 */

import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { queryClient } from "~/lib/query-client";
import { register } from "../api/auth.api";
import { meQueryOptions } from "../api/auth.api";

export function useRegister(next?: string) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: register,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey });
      navigate({ to: next && next.startsWith("/") ? next : "/" });
    },
  });
}
