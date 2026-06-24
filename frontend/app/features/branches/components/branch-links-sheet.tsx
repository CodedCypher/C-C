/**
 * circuit.rocks — branches feature: branch↔warehouse link manager Sheet.
 *
 * A right-side Sheet (NOT a modal) for managing which warehouses fulfil a
 * branch. Fetches the full warehouse list (GET /warehouses) for the option set,
 * seeds from the branch's current links, and lets the user:
 *   - toggle each warehouse on/off (checkbox)
 *   - set a `priority` number per linked warehouse (lower = preferred)
 *   - choose exactly one `isDefault` warehouse (radio, among linked ones)
 *
 * On save it PUTs the full desired link set to /branches/:id/warehouses (a full
 * replace). Backend 400/409 errors surface via `unwrapFieldErrors`.
 */

import { useEffect, useMemo, useState } from "react";
import { Warehouse } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { unwrapFieldErrors } from "~/lib/axios";

import {
  useBranchWarehouseOptions,
  useSetBranchWarehouses,
} from "../hooks/use-branches";
import { warehouseTypeLabel } from "../lib/warehouse-type";
import type { BranchDetail } from "../types/branches.types";
import { CellInput, FormErrors } from "./fields";

/** Per-warehouse draft row in the manager. */
interface LinkDraft {
  warehouseId: string;
  code: string;
  name: string;
  type: string;
  linked: boolean;
  priority: string;
  isDefault: boolean;
}

export function BranchLinksSheet({
  open,
  onOpenChange,
  branch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: BranchDetail;
}) {
  const { data: options, isLoading: optionsLoading } =
    useBranchWarehouseOptions();
  const save = useSetBranchWarehouses(branch.id);

  const [drafts, setDrafts] = useState<LinkDraft[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Build the draft list when the sheet opens (or the options/branch change):
  // every warehouse appears; linked ones carry the branch's current priority +
  // default; the rest are unchecked with a sensible next priority.
  useEffect(() => {
    if (!open || !options) return;
    const byId = new Map(branch.warehouses.map((l) => [l.warehouseId, l]));
    setDrafts(
      options.map((w) => {
        const existing = byId.get(w.id);
        return {
          warehouseId: w.id,
          code: w.code,
          name: w.name,
          type: w.type,
          linked: Boolean(existing),
          priority: existing ? String(existing.priority) : "0",
          isDefault: existing?.isDefault ?? false,
        };
      }),
    );
    setFormErrors([]);
  }, [open, options, branch.warehouses]);

  const linkedCount = useMemo(
    () => drafts.filter((d) => d.linked).length,
    [drafts],
  );

  function patch(warehouseId: string, patch: Partial<LinkDraft>) {
    setDrafts((ds) =>
      ds.map((d) => (d.warehouseId === warehouseId ? { ...d, ...patch } : d)),
    );
  }

  /** Toggle a warehouse on/off; clears its default when unlinked. */
  function toggleLinked(warehouseId: string, linked: boolean) {
    setDrafts((ds) =>
      ds.map((d) =>
        d.warehouseId === warehouseId
          ? { ...d, linked, isDefault: linked ? d.isDefault : false }
          : d,
      ),
    );
  }

  /** Choose the single default (only valid among linked warehouses). */
  function chooseDefault(warehouseId: string) {
    setDrafts((ds) =>
      ds.map((d) => ({ ...d, isDefault: d.warehouseId === warehouseId })),
    );
  }

  async function handleSave() {
    setFormErrors([]);

    const linked = drafts.filter((d) => d.linked);

    // Validate priorities are non-negative integers.
    for (const d of linked) {
      const n = Number(d.priority);
      if (d.priority.trim() === "" || !Number.isFinite(n) || n < 0) {
        setFormErrors([`Enter a valid priority (0 or more) for ${d.code}.`]);
        return;
      }
    }

    // Exactly one default among linked warehouses (if any are linked).
    if (linked.length > 0 && !linked.some((d) => d.isDefault)) {
      setFormErrors(["Choose a default warehouse for this branch."]);
      return;
    }

    const links = linked.map((d) => ({
      warehouseId: d.warehouseId,
      priority: Number(d.priority),
      isDefault: d.isDefault,
    }));

    try {
      await save.mutateAsync(links);
      onOpenChange(false);
    } catch (err) {
      const mapped = unwrapFieldErrors(err);
      setFormErrors(
        mapped?.formErrors.length
          ? mapped.formErrors
          : mapped
            ? Object.values(mapped.fieldErrors).flat()
            : ["Could not save the warehouse links. Please try again."],
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Manage warehouse links</SheetTitle>
          <SheetDescription>
            Choose which warehouses fulfil {branch.name}. Set a priority (lower is
            preferred) and pick one default warehouse. Saving replaces the current
            link set.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6">
          <FormErrors errors={formErrors} />

          {optionsLoading ? (
            <p className="font-mono text-[0.8125rem] text-smoke">
              Loading warehouses…
            </p>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 border-2 border-dashed border-line bg-paper-2 px-6 py-10 text-center">
              <div className="flex size-12 items-center justify-center border-2 border-line bg-paper text-ink shadow-press">
                <Warehouse className="size-6" aria-hidden="true" />
              </div>
              <p className="text-[0.875rem] text-smoke">
                No warehouses exist yet. Create a warehouse first, then link it
                here.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {drafts.map((d) => (
                <li
                  key={d.warehouseId}
                  className={
                    "flex flex-col gap-2 border-2 p-3 shadow-press " +
                    (d.linked
                      ? "border-line bg-paper"
                      : "border-line bg-paper-2")
                  }
                >
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 cursor-pointer accent-signal outline-none focus-visible:ring-2 focus-visible:ring-ink"
                      checked={d.linked}
                      onChange={(e) =>
                        toggleLinked(d.warehouseId, e.target.checked)
                      }
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium text-ink">{d.name}</span>
                      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.06em] text-smoke">
                        {d.code} · {warehouseTypeLabel(d.type)}
                      </span>
                    </span>
                  </label>

                  {d.linked ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-7">
                      <label className="flex items-center gap-2">
                        <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke">
                          Priority
                        </span>
                        <CellInput
                          type="text"
                          inputMode="numeric"
                          aria-label={`Priority for ${d.code}`}
                          value={d.priority}
                          onChange={(e) =>
                            patch(d.warehouseId, { priority: e.target.value })
                          }
                          className="w-20"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="branch-default-warehouse"
                          className="size-4 cursor-pointer accent-signal outline-none focus-visible:ring-2 focus-visible:ring-ink"
                          checked={d.isDefault}
                          onChange={() => chooseDefault(d.warehouseId)}
                        />
                        <span className="font-mono text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-smoke">
                          Default
                        </span>
                      </label>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-smoke">
            {linkedCount} {linkedCount === 1 ? "warehouse" : "warehouses"} linked
          </p>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t-2 border-line">
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={save.isPending || optionsLoading}
            onClick={handleSave}
          >
            {save.isPending ? "Saving…" : "Save links"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
