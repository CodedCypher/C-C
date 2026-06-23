/**
 * circuit.rocks — code-based TanStack Router route tree.
 *
 * The whole app is a client-side SPA on TanStack Router (React Router SSR has
 * been removed). Pages live INSIDE their feature folders; this file only wires
 * them into a route tree and applies the admin guard. The reference `auth` and
 * `products` features are fully wired here; the other features (dashboard,
 * inventory, orders, warehouses, branches) are added by their agents following
 * the SAME pattern:
 *
 *   1. import the feature's page component(s)
 *   2. `createRoute({ getParentRoute: () => <parent>, path, component })`
 *   3. add it to the parent's `.addChildren([...])`
 *
 * GUARD PATTERN (canonical): a pathless layout route (`adminRoute`) whose
 * `beforeLoad` calls `queryClient.ensureQueryData(meQueryOptions)` and throws a
 * `redirect` to `/login?next=` for anon/non-staff users. Child routes inherit it.
 */

import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { AdminLayout } from "~/components/shared";
import { Button } from "~/components/ui/button";
import {
  isStaff,
  meQueryOptions,
  useLogout,
  LoginPage,
  RegisterPage,
  LogoutPage,
} from "~/features/auth";
import { BranchesListPage } from "~/features/branches";
import { DashboardPage } from "~/features/dashboard";
import { InventoryListPage } from "~/features/inventory";
import { OrdersListPage } from "~/features/orders";
import { ProductsListPage, ProductNewPage } from "~/features/products";
import { WarehousesListPage } from "~/features/warehouses";
import { HomePage } from "~/features/storefront";
import { queryClient } from "~/lib/query-client";

/* ------------------------------------------------------------------ *
 * Root
 * ------------------------------------------------------------------ */

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});

/* ------------------------------------------------------------------ *
 * Public routes
 * ------------------------------------------------------------------ */

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

/** `?next=` is preserved across login/register so we bounce back after auth. */
interface AuthSearch {
  next?: string;
}

function validateAuthSearch(search: Record<string, unknown>): AuthSearch {
  const next = typeof search.next === "string" ? search.next : undefined;
  return next ? { next } : {};
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: validateAuthSearch,
  component: function LoginRoute() {
    const { next } = loginRoute.useSearch();
    return <LoginPage next={next} />;
  },
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  validateSearch: validateAuthSearch,
  component: function RegisterRoute() {
    const { next } = registerRoute.useSearch();
    return <RegisterPage next={next} />;
  },
});

const logoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logout",
  component: LogoutPage,
});

/* ------------------------------------------------------------------ *
 * Guarded admin shell (pathless layout)
 * ------------------------------------------------------------------ */

/** Logout control rendered in the Topbar's user slot. */
function AdminUserSlot() {
  const logout = useLogout();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
    >
      Log out
    </Button>
  );
}

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin",
  beforeLoad: async ({ location }) => {
    const user = await queryClient.ensureQueryData(meQueryOptions);
    if (!user || !isStaff(user.role)) {
      throw redirect({
        to: "/login",
        search: { next: location.href },
      });
    }
  },
  component: function AdminLayoutRoute() {
    return (
      <AdminLayout userSlot={<AdminUserSlot />}>
        <Outlet />
      </AdminLayout>
    );
  },
});

const productsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/products",
  component: ProductsListPage,
});

const productNewRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/products/new",
  component: ProductNewPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/dashboard",
  component: DashboardPage,
});

const inventoryRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/inventory",
  component: InventoryListPage,
});

const ordersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/orders",
  component: OrdersListPage,
});

const warehousesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/warehouses",
  component: WarehousesListPage,
});

const branchesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/branches",
  component: BranchesListPage,
});

/* ------------------------------------------------------------------ *
 * Assemble + create router
 * ------------------------------------------------------------------ */

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  logoutRoute,
  adminRoute.addChildren([
    productsRoute,
    productNewRoute,
    dashboardRoute,
    inventoryRoute,
    ordersRoute,
    warehousesRoute,
    branchesRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

/* ------------------------------------------------------------------ *
 * Fallback 404
 * ------------------------------------------------------------------ */

function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-4 text-center">
      <p className="cr-mono text-soldout">// 404</p>
      <h1 className="font-sans text-[2rem] font-bold tracking-[-0.02em] text-ink">
        Page not found
      </h1>
      <Button asChild variant="primary">
        <a href="/">Back home</a>
      </Button>
    </main>
  );
}
