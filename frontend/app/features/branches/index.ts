/**
 * circuit.rocks — branches feature barrel.
 *
 * The public surface of the feature. The router imports the page from here;
 * other features may import the row type/hook/api. Mirrors the canonical
 * export shape of the products feature.
 */

// Pages (consumed by the router)
export { BranchesListPage } from "./pages/branches-list-page";

// Hooks
export { useBranches, branchKeys } from "./hooks/use-branches";

// Api (for prefetch / route loaders)
export { getBranches } from "./api/branches.api";

// Types
export { branchRowSchema, type BranchRow } from "./types/branches.types";
