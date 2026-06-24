import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { EmptyState, PageHeader } from "~/components/shared";
import { Badge } from "~/components/ui/badge";
import { Blocks } from "lucide-react";
import { useProjectKit } from "../hooks/use-project-kits";
import { KitForm } from "../components/kit-form";

export function ProjectKitEditPage() {
  const { kitId } = useParams({ strict: false }) as { kitId: string };
  const { data, isLoading, isError } = useProjectKit(kitId);

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/project-kits"
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Project kits
      </Link>

      {isLoading ? (
        <p className="font-mono text-[0.8125rem] text-smoke">Loading kit…</p>
      ) : isError || !data ? (
        <EmptyState
          icon={<Blocks className="size-6" aria-hidden="true" />}
          title="Could not load this kit"
          description="It may have been removed from kits. Go back to the list."
        />
      ) : (
        <>
          <PageHeader
            title={data.title}
            description={`${data.sku} · ${data.partCount} parts`}
            actions={
              <Badge variant={data.published ? "stock" : "neutral"} size="md">
                {data.published ? "PUBLISHED" : "DRAFT"}
              </Badge>
            }
          />
          <KitForm mode="edit" initial={data} />
        </>
      )}
    </div>
  );
}
