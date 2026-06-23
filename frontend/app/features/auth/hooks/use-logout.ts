/**
 * circuit.rocks — auth feature: logout mutation.
 *
 * POSTs `/auth/logout` (clears the httpOnly cookies server-side), then wipes the
 * entire query cache (so no stale `me`/list data leaks across sessions) and
 * navigates to `/login`. Consumed by the shared Topbar's account controls.
 */

import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { queryClient } from "~/lib/query-client";
import { logout } from "../api/auth.api";

export function useLogout() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear();
      navigate({ to: "/login" });
    },
  });
}
