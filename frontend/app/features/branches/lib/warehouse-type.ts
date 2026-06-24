/**
 * circuit.rocks — branches feature: warehouse-type label helper.
 *
 * The link manager shows each warehouse's type. Rather than importing the
 * warehouses feature (features stay self-contained), we keep a tiny local label
 * map. Mirrors the backend `WarehouseType` enum:
 * DISTRIBUTION / RETAIL_BACKROOM / RETURNS / GENERAL.
 */

export function warehouseTypeLabel(type: string): string {
  switch (type) {
    case "DISTRIBUTION":
      return "Distribution";
    case "RETAIL_BACKROOM":
      return "Retail backroom";
    case "RETURNS":
      return "Returns";
    case "GENERAL":
      return "General";
    default:
      return type;
  }
}
