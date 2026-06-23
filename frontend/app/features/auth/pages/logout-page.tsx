/**
 * circuit.rocks — auth feature: logout page.
 *
 * Triggers `useLogout()` once on mount (POST /auth/logout → clears cookies,
 * wipes the query cache, navigates to /login). Renders a minimal "signing out"
 * notice while the mutation runs.
 */

import { useEffect, useRef } from "react";

import { useLogout } from "../hooks/use-logout";

export function LogoutPage() {
  const logout = useLogout();
  // Guard against StrictMode double-invoke firing two logout POSTs.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    logout.mutate();
  }, [logout]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4">
      <p className="cr-mono text-smoke">// signing out…</p>
    </main>
  );
}
