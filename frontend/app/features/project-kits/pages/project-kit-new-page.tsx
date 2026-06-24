import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "~/components/shared";
import { KitForm } from "../components/kit-form";

export function ProjectKitNewPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/project-kits"
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Project kits
      </Link>
      <PageHeader
        title="New project kit"
        description="Bundle catalog products into a kit. It's saved as a draft — publish it when the parts are right."
      />
      <KitForm mode="create" />
    </div>
  );
}
