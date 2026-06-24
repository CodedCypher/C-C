/**
 * circuit.rocks — branches feature: list page.
 *
 * A list of branches. Data comes from `useBranches()` (no filters, no pagination
 * — the endpoint returns a plain array). A "New branch" header action opens the
 * create Sheet; each row's code/name links to `/branches/$branchId`. Renders the
 * shared PageHeader + DataTable; TableSkeleton while loading; EmptyState when
 * empty or on error.
 *
 * CANONICAL PATTERN for a list page:
 *   - read the hook's `{ data, isLoading, isError }`
 *   - render TableSkeleton while loading, the shared DataTable otherwise
 */

import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Store } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { Button } from "~/components/ui/button";
import { useBranches } from "../hooks/use-branches";
import type { BranchRow } from "../types/branches.types";
import { BranchFormSheet } from "../components/branch-form-sheet";

const columns: Column<BranchRow>[] = [
  {
    key: "code",
    header: "Code",
    render: (r) => (
      <Link
        to="/branches/$branchId"
        params={{ branchId: r.id }}
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
        to="/branches/$branchId"
        params={{ branchId: r.id }}
        className="font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ink"
      >
        {r.name}
      </Link>
    ),
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
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Branches"
        description="Physical store locations. Walk-in pickup and over-the-counter sales run through these branches."
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" aria-hidden="true" />
            New branch
          </Button>
        }
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
              description="Create your first branch to manage walk-in pickup and over-the-counter sales."
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  New branch
                </Button>
              }
            />
          }
        />
      )}

      <BranchFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onCreated={(id) =>
          navigate({ to: "/branches/$branchId", params: { branchId: id } })
        }
      />
    </div>
  );
}
