/**
 * circuit.rocks — warehouses feature: list page.
 *
 * A simple, read-only list of warehouses. Data comes from `useWarehouses()`
 * (no filters, no pagination — the endpoint returns a plain array). Renders the
 * shared PageHeader + DataTable; TableSkeleton while loading; EmptyState when
 * empty or on error.
 *
 * CANONICAL PATTERN for a list page:
 *   - read the hook's `{ data, isLoading, isError }`
 *   - render TableSkeleton while loading, the shared DataTable otherwise
 */

import { Warehouse } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { Badge } from "~/components/ui/badge";
import { useWarehouses } from "../hooks/use-warehouses";
import type { WarehouseRow } from "../types/warehouses.types";

const columns: Column<WarehouseRow>[] = [
  {
    key: "code",
    header: "Code",
    render: (r) => (
      <span className="font-mono text-[0.8125rem] text-ink">{r.code}</span>
    ),
  },
  {
    key: "name",
    header: "Name",
    render: (r) => <span className="font-medium text-ink">{r.name}</span>,
  },
  {
    key: "type",
    header: "Type",
    render: (r) => (
      <span className="font-mono text-[0.75rem] uppercase tracking-[0.06em] text-smoke">
        {r.type}
      </span>
    ),
  },
  {
    key: "isDefaultWeb",
    header: "Default",
    align: "right",
    render: (r) =>
      r.isDefaultWeb ? (
        <Badge variant="signal" size="sm">
          Web default
        </Badge>
      ) : (
        <span className="font-mono text-[0.75rem] text-smoke">—</span>
      ),
  },
];

export function WarehousesListPage() {
  const { data, isLoading, isError } = useWarehouses();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Warehouses"
        description="Stock locations across the network. The web-default warehouse fulfils online orders."
      />

      {isLoading ? (
        <TableSkeleton rows={6} cols={columns.length} />
      ) : isError ? (
        <EmptyState
          icon={<Warehouse className="size-6" aria-hidden="true" />}
          title="Could not load warehouses"
          description="Something went wrong fetching the warehouse list. Try again."
        />
      ) : (
        <DataTable<WarehouseRow>
          columns={columns}
          rows={data ?? []}
          getRowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={<Warehouse className="size-6" aria-hidden="true" />}
              title="No warehouses yet"
              description="Warehouses you create will appear here."
            />
          }
        />
      )}
    </div>
  );
}
