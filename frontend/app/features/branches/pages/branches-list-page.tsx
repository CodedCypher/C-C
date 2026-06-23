/**
 * circuit.rocks — branches feature: list page.
 *
 * A simple, read-only list of branches. Data comes from `useBranches()` (no
 * filters, no pagination — the endpoint returns a plain array). Renders the
 * shared PageHeader + DataTable; TableSkeleton while loading; EmptyState when
 * empty or on error.
 *
 * CANONICAL PATTERN for a list page:
 *   - read the hook's `{ data, isLoading, isError }`
 *   - render TableSkeleton while loading, the shared DataTable otherwise
 */

import { Store } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { useBranches } from "../hooks/use-branches";
import type { BranchRow } from "../types/branches.types";

const columns: Column<BranchRow>[] = [
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
    key: "city",
    header: "City",
    render: (r) =>
      r.city ? (
        <span className="text-ink">{r.city}</span>
      ) : (
        <span className="font-mono text-[0.75rem] text-smoke">—</span>
      ),
  },
];

export function BranchesListPage() {
  const { data, isLoading, isError } = useBranches();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Branches"
        description="Physical store locations. Walk-in pickup and over-the-counter sales run through these branches."
      />

      {isLoading ? (
        <TableSkeleton rows={6} cols={columns.length} />
      ) : isError ? (
        <EmptyState
          icon={<Store className="size-6" aria-hidden="true" />}
          title="Could not load branches"
          description="Something went wrong fetching the branch list. Try again."
        />
      ) : (
        <DataTable<BranchRow>
          columns={columns}
          rows={data ?? []}
          getRowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={<Store className="size-6" aria-hidden="true" />}
              title="No branches yet"
              description="Branches you create will appear here."
            />
          }
        />
      )}
    </div>
  );
}
