/**
 * circuit.rocks — warehouses feature: list page.
 *
 * A list of warehouses. Data comes from `useWarehouses()` (no filters, no
 * pagination — the endpoint returns a plain array). A "New warehouse" header
 * action opens the create Sheet; each row's code/name links to the detail route
 * `/warehouses/$warehouseId`. Renders the shared PageHeader + DataTable;
 * TableSkeleton while loading; EmptyState when empty or on error.
 *
 * CANONICAL PATTERN for a list page:
 *   - read the hook's `{ data, isLoading, isError }`
 *   - render TableSkeleton while loading, the shared DataTable otherwise
 */

import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Warehouse } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useWarehouses } from "../hooks/use-warehouses";
import { warehouseTypeLabel, type WarehouseRow } from "../types/warehouses.types";
import { WarehouseFormSheet } from "../components/warehouse-form-sheet";

const columns: Column<WarehouseRow>[] = [
  {
    key: "code",
    header: "Code",
    render: (r) => (
      <Link
        to="/warehouses/$warehouseId"
        params={{ warehouseId: r.id }}
        className="font-mono text-[0.8125rem] text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ink"
      >
        {r.code}
      </Link>
    ),
  },
  {
    key: "name",
    header: "Name",
    render: (r) => (
      <Link
        to="/warehouses/$warehouseId"
        params={{ warehouseId: r.id }}
        className="font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ink"
      >
        {r.name}
      </Link>
    ),
  },
  {
    key: "type",
    header: "Type",
    render: (r) => (
      <span className="font-mono text-[0.75rem] uppercase tracking-[0.06em] text-smoke">
        {warehouseTypeLabel(r.type)}
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
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Warehouses"
        description="Stock locations across the network. The web-default warehouse fulfils online orders."
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" aria-hidden="true" />
            New warehouse
          </Button>
        }
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
              description="Create your first warehouse to start tracking stock by location."
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  New warehouse
                </Button>
              }
            />
          }
        />
      )}

      <WarehouseFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onCreated={(id) =>
          navigate({
            to: "/warehouses/$warehouseId",
            params: { warehouseId: id },
          })
        }
      />
    </div>
  );
}
