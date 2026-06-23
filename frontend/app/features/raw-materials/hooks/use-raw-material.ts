/**
 * circuit.rocks — raw-materials feature: single-material detail query hook.
 *
 * Loads the full detail (per-warehouse levels + recent movements) for the
 * detail Sheet. `enabled` lets the page keep the hook mounted but idle until a
 * material id is selected.
 */

import { useQuery } from "@tanstack/react-query";

import { getRawMaterial } from "../api/raw-materials.api";
import { rawMaterialKeys } from "./use-raw-materials";

export function useRawMaterial(id: string | null) {
  return useQuery({
    queryKey: rawMaterialKeys.detail(id ?? ""),
    queryFn: () => getRawMaterial(id as string),
    enabled: id != null,
  });
}
