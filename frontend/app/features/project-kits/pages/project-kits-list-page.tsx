import { Link, useNavigate } from "@tanstack/react-router";
import {
  Blocks,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  X,
} from "lucide-react";

import {
  type Column,
  DataTable,
  EmptyState,
  PageHeader,
  TableSkeleton,
} from "~/components/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { peso2 } from "~/lib/format";
import {
  useMoveKit,
  useProjectKits,
  usePublishKit,
  useRemoveKit,
} from "../hooks/use-project-kits";
import type { ProjectKitRow } from "../types/project-kits.types";

export function ProjectKitsListPage() {
  const { data, isLoading, isError } = useProjectKits();
  const navigate = useNavigate();
  const move = useMoveKit();
  const publish = usePublishKit();
  const remove = useRemoveKit();

  const rows = data ?? [];
  const lastIndex = rows.length - 1;

  const columns: Column<ProjectKitRow>[] = [
    {
      key: "image",
      header: "",
      width: "3.5rem",
      render: (r) => (
        <span className="flex size-11 items-center justify-center border-2 border-line bg-paper">
          {r.primaryImage ? (
            <img
              src={r.primaryImage}
              alt=""
              className="size-full object-contain p-1 [mix-blend-mode:multiply]"
            />
          ) : (
            <Blocks className="size-5 text-smoke" aria-hidden="true" />
          )}
        </span>
      ),
    },
    {
      key: "title",
      header: "Kit",
      render: (r) => (
        <Link
          to="/project-kits/$kitId"
          params={{ kitId: r.id }}
          className="font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ink"
        >
          {r.title}
        </Link>
      ),
    },
    {
      key: "parts",
      header: "Parts",
      render: (r) => (
        <span className="flex items-center gap-2">
          <span className="font-mono text-[0.8125rem] text-ink">
            {r.partCount}
          </span>
          <Badge variant={r.allInStock ? "stock" : "signal"} size="sm">
            {r.allInStock
              ? "ALL IN STOCK"
              : `${r.inStockCount}/${r.partCount} IN STOCK`}
          </Badge>
        </span>
      ),
    },
    {
      key: "partsTotal",
      header: "Parts total",
      align: "right",
      render: (r) => (
        <span className="font-mono text-[0.8125rem] text-ink">
          {peso2(r.partsTotal)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={r.published ? "stock" : "neutral"} size="sm">
          {r.published ? "PUBLISHED" : "DRAFT"}
        </Badge>
      ),
    },
    {
      key: "order",
      header: "Order",
      render: (r) => {
        const i = rows.findIndex((x) => x.id === r.id);
        return (
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Move up"
              disabled={i <= 0 || move.isPending}
              onClick={() => move.mutate({ id: r.id, direction: "up" })}
              className="border-2 border-line p-0.5 text-smoke disabled:opacity-30 hover:enabled:text-ink"
            >
              <ChevronUp className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={i === lastIndex || move.isPending}
              onClick={() => move.mutate({ id: r.id, direction: "down" })}
              className="border-2 border-line p-0.5 text-smoke disabled:opacity-30 hover:enabled:text-ink"
            >
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <span className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            disabled={publish.isPending}
            onClick={() =>
              publish.mutate({ id: r.id, published: !r.published })
            }
            className="inline-flex items-center gap-1 border-2 border-line px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-ink hover:bg-signal/15 disabled:opacity-50"
          >
            {r.published ? (
              <>
                <EyeOff className="size-3.5" aria-hidden="true" /> Unpublish
              </>
            ) : (
              <>
                <Eye className="size-3.5" aria-hidden="true" /> Publish
              </>
            )}
          </button>
          <button
            type="button"
            aria-label={`Remove ${r.title} from kits`}
            disabled={remove.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Remove "${r.title}" from project kits? The product itself is kept.`,
                )
              ) {
                remove.mutate(r.id);
              }
            }}
            className="border-2 border-line p-1 text-smoke hover:text-soldout disabled:opacity-50"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Project Kits"
        description="Curated build-a-project kits shown on the storefront. Each kit bundles catalog parts that shoppers add to cart together."
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => navigate({ to: "/project-kits/new" })}
          >
            <Plus className="size-4" aria-hidden="true" />
            New kit
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={5} cols={columns.length} />
      ) : isError ? (
        <EmptyState
          icon={<Blocks className="size-6" aria-hidden="true" />}
          title="Could not load project kits"
          description="Something went wrong fetching the kit list. Try again."
        />
      ) : (
        <DataTable<ProjectKitRow>
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={<Blocks className="size-6" aria-hidden="true" />}
              title="No project kits yet"
              description="Create your first kit to feature it on the storefront's build-a-project page."
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => navigate({ to: "/project-kits/new" })}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  New kit
                </Button>
              }
            />
          }
        />
      )}
    </div>
  );
}
