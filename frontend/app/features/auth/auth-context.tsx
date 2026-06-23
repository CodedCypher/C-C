/**
 * circuit.rocks — auth feature: current-user context.
 *
 * `AuthProvider` wraps the app (mounted in `main.tsx`, inside QueryClientProvider)
 * and backs the current user with the shared `me` query. `useAuth()` exposes
 * `{ user, isLoading }` to any component that needs the signed-in user without
 * re-running the query. Route-level guards do NOT use this — they call
 * `queryClient.ensureQueryData(meQueryOptions)` in `beforeLoad` instead.
 */

import { createContext, useContext, type ReactNode } from "react";

import { useMe } from "./hooks/use-me";
import type { User } from "./types/auth.types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useMe();
  return (
    <AuthContext.Provider value={{ user: data ?? null, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
