import { api } from "~/lib/axios";
import {
  kitIdResultSchema,
  kitMoveResultSchema,
  kitPartOptionsSchema,
  kitPublishResultSchema,
  projectKitDetailSchema,
  projectKitsListSchema,
  type KitIdResult,
  type KitPartOption,
  type ProjectKitDetail,
  type ProjectKitRow,
} from "../types/project-kits.types";

/**
 * Pure data-access for project kits. Every response is parsed through a zod
 * schema so callers get runtime-validated data. No react/query here.
 */

export interface KitPartBody {
  stockItemId: string;
  quantity: string;
}

export interface CreateProjectKitBody {
  title: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  kitPrice: string;
  parts: KitPartBody[];
}

export interface UpdateProjectKitBody {
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  kitPrice?: string;
  position?: number;
  parts?: KitPartBody[];
}

// GET /project-kits — full kit list (drafts + published)
export async function getProjectKits(): Promise<ProjectKitRow[]> {
  const res = await api.get("/project-kits");
  return projectKitsListSchema.parse(res.data);
}

// GET /project-kits/:id — kit detail for the edit form (id = BUILT variant id)
export async function getProjectKit(id: string): Promise<ProjectKitDetail> {
  const res = await api.get(`/project-kits/${id}`);
  return projectKitDetailSchema.parse(res.data);
}

// POST /project-kits — create a kit (product + BUILT variant + BOM)
export async function createProjectKit(
  body: CreateProjectKitBody,
): Promise<KitIdResult> {
  const res = await api.post("/project-kits", body);
  return kitIdResultSchema.parse(res.data);
}

// PATCH /project-kits/:id — update marketing / price / position / parts
export async function updateProjectKit(
  id: string,
  body: UpdateProjectKitBody,
): Promise<KitIdResult> {
  const res = await api.patch(`/project-kits/${id}`, body);
  return kitIdResultSchema.parse(res.data);
}

// PATCH /project-kits/:id/publish — toggle storefront visibility
export async function setKitPublished(id: string, published: boolean) {
  const res = await api.patch(`/project-kits/${id}/publish`, { published });
  return kitPublishResultSchema.parse(res.data);
}

// PATCH /project-kits/:id/move — reorder up/down
export async function moveKit(id: string, direction: "up" | "down") {
  const res = await api.patch(`/project-kits/${id}/move`, { direction });
  return kitMoveResultSchema.parse(res.data);
}

// DELETE /project-kits/:id — remove from kits (unflag; product survives)
export async function removeKit(id: string): Promise<KitIdResult> {
  const res = await api.delete(`/project-kits/${id}`);
  return kitIdResultSchema.parse(res.data);
}

// GET /inventory/options?kind=VARIANT — catalog products usable as kit parts
export async function getKitPartOptions(q: string): Promise<KitPartOption[]> {
  const res = await api.get("/inventory/options", {
    params: { kind: "VARIANT", q: q || undefined },
  });
  return kitPartOptionsSchema.parse(res.data);
}
