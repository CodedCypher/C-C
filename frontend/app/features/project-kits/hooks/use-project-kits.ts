import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createProjectKit,
  getKitPartOptions,
  getProjectKit,
  getProjectKits,
  moveKit,
  removeKit,
  setKitPublished,
  updateProjectKit,
  uploadProjectKitImage,
  type CreateProjectKitBody,
  type UpdateProjectKitBody,
} from "../api/project-kits.api";

export const projectKitKeys = {
  all: ["project-kits"] as const,
  lists: () => ["project-kits", "list"] as const,
  detail: (id: string) => ["project-kits", "detail", id] as const,
  partOptions: (q: string) => ["project-kits", "part-options", q] as const,
};

export function useProjectKits() {
  return useQuery({
    queryKey: projectKitKeys.lists(),
    queryFn: getProjectKits,
  });
}

export function useProjectKit(id: string) {
  return useQuery({
    queryKey: projectKitKeys.detail(id),
    queryFn: () => getProjectKit(id),
    enabled: Boolean(id),
  });
}

export function useCreateProjectKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProjectKitBody) => createProjectKit(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKitKeys.lists() });
    },
  });
}

export function useUploadKitImage() {
  return useMutation({
    mutationFn: (file: File) => uploadProjectKitImage(file),
  });
}

export function useUpdateProjectKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateProjectKitBody }) =>
      updateProjectKit(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: projectKitKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: projectKitKeys.lists() });
    },
  });
}

export function usePublishKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      setKitPublished(id, published),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: projectKitKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: projectKitKeys.lists() });
    },
  });
}

export function useMoveKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: "up" | "down" }) =>
      moveKit(id, direction),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKitKeys.lists() });
    },
  });
}

export function useRemoveKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeKit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKitKeys.lists() });
    },
  });
}

/** Search catalog products to add as kit parts (debounce the term in the UI). */
export function useKitPartOptions(term: string, enabled: boolean) {
  return useQuery({
    queryKey: projectKitKeys.partOptions(term),
    queryFn: () => getKitPartOptions(term),
    enabled,
    staleTime: 30_000,
  });
}
