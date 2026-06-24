/**
 * circuit.rocks — storefront Projects index (public route /projects).
 *
 * The "build-a-project" gallery: curated kits whose bill of materials the
 * backend resolves into purchasable, in-stock parts. Each card links to the kit
 * detail page where the maker one-click-adds the resolved parts to their cart —
 * the friction-killer the hackathon theme is about.
 */

import { Link } from "@tanstack/react-router";
import { Boxes, Package, Sparkles } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { peso2 } from "~/lib/format";

import { useProjects } from "../hooks/use-storefront";
import type { ProjectSummary } from "../types/storefront.types";

const MAXW = "mx-auto max-w-[1320px]";

function Header() {
  return (
    <header className="flex flex-col gap-3 border-b-2 border-line pb-8">
      <span className="font-mono text-[0.75rem] uppercase tracking-[0.08em] text-smoke">
        // build-a-project
      </span>
      <h1 className="font-sans text-[2.25rem] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
        Project kits, resolved to a cart
      </h1>
      <p className="max-w-[60ch] text-[1rem] leading-[1.6] text-smoke">
        Pick a build. We read its bill of materials, match every part to an
        in-stock component, and drop the whole list in your cart — ready to check
        out. No more abandoned projects.
      </p>
      <div className="pt-1">
        <Button asChild variant="primary" size="lg">
          <Link to="/build">
            <Sparkles className="size-4" aria-hidden="true" />
            Build from your own parts list →
          </Link>
        </Button>
      </div>
    </header>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link
      to="/projects/$slug"
      params={{ slug: project.slug }}
      className="cr-press flex flex-col border-2 border-line bg-paper no-underline shadow-brutal hover:shadow-press active:shadow-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b-2 border-line bg-paper">
        <span className="absolute left-2 top-2 z-[2]">
          <Badge variant={project.allInStock ? "stock" : "signal"} size="sm">
            {project.allInStock
              ? "ALL IN STOCK"
              : `${project.inStockCount}/${project.partCount} IN STOCK`}
          </Badge>
        </span>
        {project.primaryImage ? (
          <img
            src={project.primaryImage}
            alt={project.title}
            className="h-full w-full p-5 [mix-blend-mode:multiply] [object-fit:contain]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="size-14 text-smoke" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
          <Boxes className="size-3.5" aria-hidden="true" />
          {project.partCount} parts
        </span>
        <h2 className="line-clamp-2 min-h-[2.4em] font-sans text-[1.0625rem] font-semibold leading-[1.2] text-ink">
          {project.title}
        </h2>
        <div className="mt-auto flex items-baseline justify-between gap-2 pt-2">
          <span className="font-mono text-[1.125rem] font-bold text-ink">
            {peso2(project.estimatedTotal)}
          </span>
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
            parts total →
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ProjectsListPage() {
  const { data: projects, isLoading, isError } = useProjects();

  return (
    <div className={`${MAXW} flex flex-col gap-8 px-6 py-12`}>
      <Header />

      {isLoading && (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse border-2 border-line bg-paper-2"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="font-mono text-[0.875rem] text-soldout">
          // failed to load projects — is the API running?
        </p>
      )}

      {projects && projects.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Package className="size-12 text-smoke" aria-hidden="true" />
          <p className="text-smoke">No project kits published yet.</p>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {projects.map((p) => (
            <ProjectCard key={p.variantId} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
