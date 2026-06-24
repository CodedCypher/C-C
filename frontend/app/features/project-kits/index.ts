/**
 * Public surface of the project-kits feature. The router imports the pages from
 * here; other code may import the hooks/api/types. Mirrors the canonical shape.
 */

// Pages (consumed by the router)
export { ProjectKitsListPage } from "./pages/project-kits-list-page";
export { ProjectKitNewPage } from "./pages/project-kit-new-page";
export { ProjectKitEditPage } from "./pages/project-kit-edit-page";

// Hooks
export {
  useProjectKits,
  useProjectKit,
  useCreateProjectKit,
  useUpdateProjectKit,
  usePublishKit,
  useMoveKit,
  useRemoveKit,
  useKitPartOptions,
  projectKitKeys,
} from "./hooks/use-project-kits";

// Api
export {
  getProjectKits,
  getProjectKit,
  createProjectKit,
  updateProjectKit,
  setKitPublished,
  moveKit,
  removeKit,
  getKitPartOptions,
  type CreateProjectKitBody,
  type UpdateProjectKitBody,
  type KitPartBody,
} from "./api/project-kits.api";

// Types
export {
  projectKitRowSchema,
  projectKitDetailSchema,
  projectKitPartSchema,
  createProjectKitSchema,
  kitPartOptionSchema,
  type ProjectKitRow,
  type ProjectKitDetail,
  type ProjectKitPart,
  type CreateProjectKitInput,
  type KitPartOption,
  type KitStockState,
} from "./types/project-kits.types";
