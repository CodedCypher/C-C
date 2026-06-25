/**
 * circuit.rocks — "My builds" (public route /my-builds).
 *
 * Every build a maker resolves is persisted, so it survives the session and can
 * be reopened, reshared, or deleted later — the anti-abandonment half of the
 * build flow. Ownership is by signed-in user when authed, else the cr_cart
 * guest cookie, so the list works without an account.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ClipboardList,
  ImageUp,
  Link2,
  Package,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";

import { Button } from "~/components/ui/button";

import { useDeleteBuild, useMyBuilds } from "../hooks/use-storefront";
import {
  BUILD_SOURCE_META,
  type BuildSource,
  type BuildSummary,
} from "../types/storefront.types";

const MAXW = "mx-auto max-w-[1320px]";

const SOURCE_ICON: Record<BuildSource, typeof ClipboardList> = {
  TEXT: ClipboardList,
  URL: Link2,
  IMAGE: ImageUp,
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export function MyBuildsPage() {
  const { data: builds, isLoading } = useMyBuilds();
  const del = useDeleteBuild();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function reshare(id: string) {
    const link = `${window.location.origin}/builds/${id}`;
    void navigator.clipboard?.writeText(link);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  }

  return (
    <div className={`${MAXW} flex flex-col gap-8 px-6 py-12`}>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-line pb-8">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[0.75rem] uppercase tracking-[0.08em] text-smoke">
            // your builds
          </span>
          <h1 className="font-sans text-[2.25rem] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
            Saved builds
          </h1>
          <p className="max-w-[60ch] text-[1rem] leading-[1.6] text-smoke">
            Every parts list or photo you resolve is saved here — reopen,
            reshare, or clear them out.
          </p>
        </div>
        <Link to="/build">
          <Button variant="primary" size="lg">
            <Plus size={16} strokeWidth={2.5} />
            New build
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse border-2 border-line bg-paper"
            />
          ))}
        </div>
      ) : !builds || builds.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {builds.map((b) => (
            <BuildCard
              key={b.id}
              build={b}
              copied={copiedId === b.id}
              deleting={del.isPending && del.variables === b.id}
              onReshare={() => reshare(b.id)}
              onDelete={() => del.mutate(b.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BuildCard({
  build,
  copied,
  deleting,
  onReshare,
  onDelete,
}: {
  build: BuildSummary;
  copied: boolean;
  deleting: boolean;
  onReshare: () => void;
  onDelete: () => void;
}) {
  const Icon = SOURCE_ICON[build.sourceType];
  return (
    <div className="flex flex-col justify-between gap-4 border-2 border-line bg-paper p-4 shadow-brutal">
      <Link
        to="/builds/$id"
        params={{ id: build.id }}
        className="flex flex-col gap-2"
      >
        <span className="inline-flex w-fit items-center gap-1.5 border-2 border-line px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.06em] text-smoke">
          <Icon size={12} strokeWidth={2.5} />
          {BUILD_SOURCE_META[build.sourceType].label}
        </span>
        <h2 className="font-sans text-[1.0625rem] font-bold leading-[1.2] text-ink">
          {build.title}
        </h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.75rem] text-smoke">
          <Package size={13} strokeWidth={2} />
          {build.partCount} part{build.partCount === 1 ? "" : "s"} ·{" "}
          {fmtDate(build.createdAt)}
        </span>
      </Link>

      <div className="flex items-center gap-2 border-t-2 border-line pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={onReshare}>
          <Share2 size={14} strokeWidth={2.5} />
          {copied ? "Copied!" : "Reshare"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={deleting}
          className="text-soldout"
        >
          <Trash2 size={14} strokeWidth={2.5} />
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 border-2 border-dashed border-line bg-paper px-6 py-16 text-center">
      <Package size={32} strokeWidth={1.5} className="text-smoke" />
      <p className="max-w-[42ch] text-[0.9375rem] leading-[1.6] text-smoke">
        No saved builds yet. Paste a parts list or snap a schematic to resolve
        your first build.
      </p>
      <Link to="/build">
        <Button variant="primary" size="lg">
          <Plus size={16} strokeWidth={2.5} />
          Start a build
        </Button>
      </Link>
    </div>
  );
}
