/**
 * circuit.rocks — SPA entry point.
 *
 * Mounts the client-side React tree:
 *   QueryClientProvider → AuthProvider → RouterProvider
 * QueryClient must wrap AuthProvider (which runs the `me` query) and the router
 * (whose `beforeLoad` guards call `queryClient.ensureQueryData`).
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { AuthProvider } from "~/features/auth";
import { queryClient } from "~/lib/query-client";
import { router } from "~/router";

import "./app.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
