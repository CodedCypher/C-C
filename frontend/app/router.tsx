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
import { BranchesListPage, BranchDetailPage } from "~/features/branches";
import {
  ProjectKitsListPage,
  ProjectKitNewPage,
  ProjectKitEditPage,
} from "~/features/project-kits";
import { PaymentMethodsListPage } from "~/features/payment-methods";
import { DashboardPage } from "~/features/dashboard";
import { InventoryListPage, InventoryItemPage } from "~/features/inventory";
import { OrdersListPage, OrderDetailPage } from "~/features/orders";
import { ProductsListPage, ProductNewPage } from "~/features/products";
import { RawMaterialsListPage } from "~/features/raw-materials";
import {
  TransfersListPage,
  TransferNewPage,
  TransferDetailPage,
} from "~/features/transfers";
import { BomListPage, BomEditorPage } from "~/features/bom";
import {
  BuildOrdersListPage,
  BuildOrderNewPage,
  BuildOrderDetailPage,
} from "~/features/build-orders";
import { WarehousesListPage, WarehouseDetailPage } from "~/features/warehouses";
import {
  HomePage,
  StorefrontLayout,
  ProductDetailPage,
  ProjectsListPage,
  ProjectDetailPage,
  BuildChatPage,
  BuildDetailPage,
  MyBuildsPage,
  CheckoutPage,
} from "~/features/storefront";
import {
  AccountLayout,
  MyOrdersPage,
  MyOrderDetailPage,
  AddressesPage,
  ProfilePage,
} from "~/features/account";
import { queryClient } from "~/lib/query-client";

/* ------------------------------------------------------------------ *
 * Root
 * ------------------------------------------------------------------ */

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});

/* ------------------------------------------------------------------ *
 * Public storefront (pathless layout — NO auth guard)
 * ------------------------------------------------------------------ *
 * Mirrors the admin shell pattern but public: a pathless layout route renders
 * the storefront chrome (AnnouncementBar / NavHeader / Footer / cart drawer)
 * via `StorefrontLayout`, and its children are the shopper-facing pages. The
 * PDP at /products/$slug is intentionally a SIBLING namespace to the guarded
 * admin /products list (distinct route nodes, no literal collision).
 */

const storefrontRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "storefront",
  component: StorefrontLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => storefrontRoute,
  path: "/",
  component: HomePage,
});

const productDetailRoute = createRoute({
  getParentRoute: () => storefrontRoute,
  path: "/products/$slug",
  component: ProductDetailPage,
});

const projectsRoute = createRoute({
  getParentRoute: () => storefrontRoute,
  path: "/projects",
  component: ProjectsListPage,
});

const projectDetailRoute = createRoute({
  getParentRoute: () => storefrontRoute,
  path: "/projects/$slug",
  component: ProjectDetailPage,
});

const buildRoute = createRoute({
  getParentRoute: () => storefrontRoute,
  path: "/build",
  component: BuildChatPage,
});

const buildChatRoute = createRoute({
  getParentRoute: () => storefrontRoute,
  path: "/build/$chatId",
  component: BuildChatPage,
});

const buildDetailRoute = createRoute({
  getParentRoute: () => storefrontRoute,
  path: "/builds/$id",
  component: BuildDetailPage,
});

const myBuildsRoute = createRoute({
  getParentRoute: () => storefrontRoute,
  path: "/my-builds",
  component: MyBuildsPage,
});

const checkoutRoute = createRoute({
  getParentRoute: () => storefrontRoute,
  path: "/checkout",
  component: CheckoutPage,
});

/* ------------------------------------------------------------------ *
 * Account hub (auth-gated pathless layout, child of the storefront shell)
 * ------------------------------------------------------------------ *
 * Renders INSIDE the public storefront chrome (it's a child of `storefrontRoute`,
 * so the NavHeader/Footer stay). Unlike the admin guard, ANY authenticated role
 * is allowed (no `isStaff` check) — these are customer-owned resources.
 */

const accountRoute = createRoute({
  getParentRoute: () => storefrontRoute,
  id: "account",
  beforeLoad: async ({ location }) => {
    const user = await queryClient.ensureQueryData(meQueryOptions);
    if (!user) {
      throw redirect({
        to: "/login",
        search: { next: location.href },
      });
    }
  },
  component: AccountLayout,
});

const accountIndexRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "/account",
  component: MyOrdersPage,
});

const accountOrdersRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "/account/orders",
  component: MyOrdersPage,
});

const accountOrderDetailRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "/account/orders/$orderId",
  component: MyOrderDetailPage,
});

const accountAddressesRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "/account/addresses",
  component: AddressesPage,
});

const accountProfileRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "/account/profile",
  component: ProfilePage,
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

const orderDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/orders/$orderId",
  component: OrderDetailPage,
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

const branchDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/branches/$branchId",
  component: BranchDetailPage,
});

const projectKitsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/project-kits",
  component: ProjectKitsListPage,
});

const projectKitNewRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/project-kits/new",
  component: ProjectKitNewPage,
});

const projectKitEditRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/project-kits/$kitId",
  component: ProjectKitEditPage,
});

const paymentMethodsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/payment-methods",
  component: PaymentMethodsListPage,
});

const warehouseDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/warehouses/$warehouseId",
  component: WarehouseDetailPage,
});

const inventoryItemRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/inventory/$stockItemId",
  component: InventoryItemPage,
});

const rawMaterialsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/raw-materials",
  component: RawMaterialsListPage,
});

const transfersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/transfers",
  component: TransfersListPage,
});

const transferNewRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/transfers/new",
  component: TransferNewPage,
});

const transferDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/transfers/$transferId",
  component: TransferDetailPage,
});

const bomsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/boms",
  component: BomListPage,
});

const bomEditorRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/boms/$variantId",
  component: BomEditorPage,
});

const buildOrdersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/build-orders",
  component: BuildOrdersListPage,
});

const buildOrderNewRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/build-orders/new",
  component: BuildOrderNewPage,
});

const buildOrderDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/build-orders/$buildOrderId",
  component: BuildOrderDetailPage,
});

/* ------------------------------------------------------------------ *
 * Assemble + create router
 * ------------------------------------------------------------------ */

const routeTree = rootRoute.addChildren([
  storefrontRoute.addChildren([
    indexRoute,
    productDetailRoute,
    projectsRoute,
    projectDetailRoute,
    buildRoute,
    buildChatRoute,
    buildDetailRoute,
    myBuildsRoute,
    checkoutRoute,
    accountRoute.addChildren([
      accountIndexRoute,
      accountOrdersRoute,
      accountOrderDetailRoute,
      accountAddressesRoute,
      accountProfileRoute,
    ]),
  ]),
  loginRoute,
  registerRoute,
  logoutRoute,
  adminRoute.addChildren([
    productsRoute,
    productNewRoute,
    dashboardRoute,
    inventoryRoute,
    inventoryItemRoute,
    ordersRoute,
    orderDetailRoute,
    warehousesRoute,
    warehouseDetailRoute,
    branchesRoute,
    branchDetailRoute,
    projectKitsRoute,
    projectKitNewRoute,
    projectKitEditRoute,
    paymentMethodsRoute,
    rawMaterialsRoute,
    transfersRoute,
    transferNewRoute,
    transferDetailRoute,
    bomsRoute,
    bomEditorRoute,
    buildOrdersRoute,
    buildOrderNewRoute,
    buildOrderDetailRoute,
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
