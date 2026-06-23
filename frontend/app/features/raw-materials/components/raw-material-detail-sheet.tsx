/**
 * circuit.rocks — raw-materials feature: detail Sheet.
 *
 * A right-side Sheet (NOT a modal) showing a single material: summary rows,
 * a per-warehouse levels table, and a recent-movements table. Footer actions
 * are Edit (hands control back to the page to open the form Sheet) and Delete
 * (inline two-step confirm — no blocking dialog).
 *
 * Data comes from `useRawMaterial(id)`; the page passes the selected id and
 * keeps this mounted so the query caches per material.
 */

import { useEffect, useState } from "react";
import { Boxes, Pencil, Trash2 } from "lucide-react";

import { EmptyState } from "~/components/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { unwrapFieldErrors } from "~/lib/axios";
import { formatDate, peso } from "~/lib/format";
import { cn } from "~/lib/utils";
import { useDeleteRawMaterial } from "../hooks/use-delete-raw-material";
import { useRawMaterial } from "../hooks/use-raw-material";
import type { RawMaterialDetail } from "../types/raw-materials.types";
import { DetailRow, labelClass } from "./fields";

export interface RawMaterialDetailSheetProps {
  /** The selected material id, or null when nothing is open. */
  materialId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open the edit form for the loaded material. */
  onEdit: (material: RawMaterialDetail) => void;
  /** Called after a successful delete (e.g. to close the Sheet). */
  onDeleted?: (id: string) => void;
}

function colorFor(available: number, onHand: number): string {
  if (available <= 0) return "text-soldout";
  if (available < onHand) return "text-hazard";
  return "text-ink";
}

export function RawMaterialDetailSheet({
  materialId,
  open,
  onOpenChange,
  onEdit,
  onDeleted,
}: RawMaterialDetailSheetProps) {
  const { data, isLoading, isError } = useRawMaterial(
    open ? materialId : null,
  );
  const deleteMaterial = useDeleteRawMaterial();

  // Two-step inline delete confirm + a slot for a delete failure message.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset the confirm/error state whenever the Sheet (re)opens or target swaps.
  useEffect(() => {
    setConfirmingDelete(false);
    setDeleteError(null);
  }, [open, materialId]);

  async function handleDelete() {
    if (!data) return;
    setDeleteError(null);
    try {
      await deleteMaterial.mutateAsync(data.id);
      onDeleted?.(data.id);
      onOpenChange(false);
    } catch (err) {
      const unwrapped = unwrapFieldErrors(err);
      setDeleteError(
        unwrapped?.formErrors[0] ??
          "Could not delete this material. It may be in use.",
      );
      setConfirmingDelete(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{data?.name ?? "Material"}</SheetTitle>
          <SheetDescription>
            {data ? (
              <span className="font-mono text-smoke">{data.sku}</span>
            ) : (
              "Loading material…"
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div
              role="status"
              aria-busy="true"
              className="flex flex-col gap-3"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse border-2 border-line bg-paper-2 motion-reduce:animate-none"
                />
              ))}
              <span className="sr-only">Loading…</span>
            </div>
          ) : isError || !data ? (
            <EmptyState
              icon={<Boxes className="size-6" aria-hidden="true" />}
              title="Could not load material"
              description="Something went wrong fetching this material. Close and try again."
            />
          ) : (
            <>
              {/* ── Summary ── */}
              <section className="flex flex-col">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="neutral" size="sm">
                    {data.defaultUnit}
                  </Badge>
                  {data.trackLot ? (
                    <Badge variant="neutral" size="sm">
                      Lot-tracked
                    </Badge>
                  ) : null}
                  {data.trackSerial ? (
                    <Badge variant="neutral" size="sm">
                      Serial-tracked
                    </Badge>
                  ) : null}
                </div>

                {data.description ? (
                  <p className="mb-3 text-[0.875rem] leading-relaxed text-smoke">
                    {data.description}
                  </p>
                ) : null}

                <div className="flex flex-col">
                  <DetailRow label="Standard cost">
                    {data.standardCost == null ? "—" : peso(data.standardCost)}
                  </DetailRow>
                  <DetailRow label="On hand">{data.onHand}</DetailRow>
                  <DetailRow label="Reserved">{data.reserved}</DetailRow>
                  <DetailRow label="Available">
                    <span
                      className={cn(
                        "font-bold",
                        colorFor(data.available, data.onHand),
                      )}
                    >
                      {data.available}
                    </span>
                  </DetailRow>
                  <DetailRow label="Incoming">{data.incoming}</DetailRow>
                  <DetailRow label="Reorder point">
                    {data.reorderPoint ?? "—"}
                  </DetailRow>
                  <DetailRow label="Reorder qty">
                    {data.reorderQty ?? "—"}
                  </DetailRow>
                  <DetailRow label="Safety stock">
                    {data.safetyStock ?? "—"}
                  </DetailRow>
                </div>
              </section>

              {/* ── Per-warehouse levels ── */}
              <section className="flex flex-col gap-2">
                <h3 className={labelClass}>Per-warehouse levels</h3>
                {data.warehouses.length === 0 ? (
                  <p className="font-mono text-[0.75rem] text-smoke">
                    Not stocked at any warehouse yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto border-2 border-line">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-carbon">
                          {[
                            "Warehouse",
                            "On hand",
                            "Reserved",
                            "Available",
                            "Incoming",
                          ].map((h, i) => (
                            <th
                              key={h}
                              className={cn(
                                "cr-mono whitespace-nowrap px-3 py-2 text-[0.625rem] font-bold text-paper",
                                i === 0 ? "text-left" : "text-right",
                              )}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.warehouses.map((w) => (
                          <tr
                            key={w.warehouseId}
                            className="border-t-2 border-line odd:bg-paper even:bg-paper-2"
                          >
                            <td className="px-3 py-2 text-[0.8125rem]">
                              <span className="font-medium text-ink">
                                {w.name}
                              </span>
                              <span className="ml-1 font-mono text-[0.6875rem] text-smoke">
                                {w.code}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-[0.8125rem] text-ink">
                              {w.onHand}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-[0.8125rem] text-smoke">
                              {w.reserved}
                            </td>
                            <td
                              className={cn(
                                "px-3 py-2 text-right font-mono text-[0.8125rem] font-bold",
                                colorFor(w.available, w.onHand),
                              )}
                            >
                              {w.available}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-[0.8125rem] text-smoke">
                              {w.incoming}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* ── Recent movements ── */}
              <section className="flex flex-col gap-2">
                <h3 className={labelClass}>Recent movements</h3>
                {data.movements.length === 0 ? (
                  <p className="font-mono text-[0.75rem] text-smoke">
                    No stock movements recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto border-2 border-line">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-carbon">
                          {["Date", "WH", "Qty", "Reason"].map((h, i) => (
                            <th
                              key={h}
                              className={cn(
                                "cr-mono whitespace-nowrap px-3 py-2 text-[0.625rem] font-bold text-paper",
                                i === 2 ? "text-right" : "text-left",
                              )}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.movements.map((m) => (
                          <tr
                            key={m.id}
                            className="border-t-2 border-line odd:bg-paper even:bg-paper-2"
                          >
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-[0.75rem] text-smoke">
                              {formatDate(m.createdAt)}
                            </td>
                            <td className="px-3 py-2 font-mono text-[0.75rem] text-smoke">
                              {m.warehouseCode}
                            </td>
                            <td
                              className={cn(
                                "px-3 py-2 text-right font-mono text-[0.8125rem] font-bold",
                                m.qtyDelta < 0 ? "text-soldout" : "text-stock",
                              )}
                            >
                              {m.qtyDelta > 0 ? "+" : ""}
                              {m.qtyDelta}
                            </td>
                            <td className="px-3 py-2 text-[0.8125rem] text-ink">
                              <span className="font-mono">{m.reason}</span>
                              {m.note ? (
                                <span className="ml-1 text-smoke">
                                  — {m.note}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* ── Footer actions ── */}
        {data ? (
          <div className="mt-auto flex flex-col gap-3 border-t-2 border-line p-6">
            {deleteError ? (
              <p className="font-mono text-[0.75rem] leading-snug text-soldout">
                {deleteError}
              </p>
            ) : null}

            {confirmingDelete ? (
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[0.75rem] text-soldout">
                  Delete “{data.name}”? This can't be undone.
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleteMaterial.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleteMaterial.isPending}
                    className="bg-soldout text-paper"
                  >
                    {deleteMaterial.isPending ? "Deleting…" : "Confirm delete"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={deleteMaterial.isPending}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => onEdit(data)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
