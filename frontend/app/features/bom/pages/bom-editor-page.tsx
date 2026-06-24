/**
 * circuit.rocks — bom feature: per-variant BOM editor (route /boms/$variantId).
 *
 * The centerpiece of the feature. For one product variant it lets you:
 *   - Version bar: pick among the variant's BOM versions (active one badged),
 *     start a NEW draft version, or ACTIVATE the selected non-active version.
 *   - Line editor: a table of inputs (stock-item picker via /inventory/options
 *     + quantity + unit + scrap% + remove). Save = POST /bom (new version) or
 *     PATCH /bom/:id (edit existing). The payload is built + client-validated
 *     with the zod schema; dotted field errors (`lines.0.quantity`) and the
 *     cyclic/self 400/409 are mapped back via `unwrapFieldErrors`.
 *   - Explosion panel: qty input → GET /bom/:id/explode → recursive BomTree +
 *     flattened leaf totals. The 409 cyclic case shows a clear message.
 *   - Cost panel: GET /bom/:id/cost at the same qty → unit + extended cost
 *     (peso, "—" when null) + a per-line cost table + a missing-cost note.
 *   - Feasibility panel: qty + warehouse → GET /bom/:id/feasibility → canBuild,
 *     buildableMax, and a shortfalls table when not feasible.
 *
 * Mirrors the products create-form approach (a client line model + buildPayload
 * + schema.safeParse on submit), but uses a simpler `useState` array of line
 * drafts since the BOM has no derived matrix.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { z } from "zod";
import {
  ArrowLeft,
  Calculator,
  ListTree,
  Network,
  Plus,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  StatusPill,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { unwrapFieldErrors } from "~/lib/axios";
import { peso } from "~/lib/format";
import { cn } from "~/lib/utils";
import {
  useBom,
  useBomCost,
  useBomExplosion,
  useBomFeasibility,
  useBomVariants,
  useBomVersions,
  useBomWarehouseOptions,
  useBomWhereUsed,
} from "../hooks/use-bom";
import {
  useActivateBom,
  useCreateBom,
  useUpdateBom,
} from "../hooks/use-bom-mutations";
import { StockItemPicker } from "../components/stock-item-picker";
import { BomTree } from "../components/bom-tree";
import {
  CellInput,
  CellSelect,
  FieldError,
  errorFor,
  labelClass,
  type FieldErrors,
} from "../components/fields";
import {
  createBomSchema,
  updateBomSchema,
  UNIT_OPTIONS,
  type BomCostLine,
  type BomDetail,
  type BomLeaf,
  type BomLineInput,
  type BomShortfall,
  type BomStockItemOption,
  type BomVersion,
  type BomWhereUsed,
  type UnitOfMeasure,
} from "../types/bom.types";

/* ------------------------------------------------------------------ *
 * Client-only line draft model
 * ------------------------------------------------------------------ */

interface LineDraft {
  key: number;
  /** The picked option (null until chosen). Used to display name/SKU/uom. */
  option: BomStockItemOption | null;
  /** Pre-existing line metadata (when editing a saved BOM) for display. */
  existingName: string | null;
  existingSku: string | null;
  stockItemId: string;
  quantity: string;
  unit: UnitOfMeasure;
  scrapPct: string;
}

let lineSeq = 0;
function blankLine(): LineDraft {
  return {
    key: ++lineSeq,
    option: null,
    existingName: null,
    existingSku: null,
    stockItemId: "",
    quantity: "",
    unit: "EACH",
    scrapPct: "",
  };
}

/** Hydrate the line drafts from a saved BOM detail's lines. */
function linesFromDetail(detail: BomDetail): LineDraft[] {
  return detail.lines.map((l) => ({
    key: ++lineSeq,
    option: null,
    existingName: l.name,
    existingSku: l.sku,
    stockItemId: l.stockItemId,
    quantity: String(l.quantity),
    unit: (UNIT_OPTIONS as readonly string[]).includes(l.uom)
      ? (l.uom as UnitOfMeasure)
      : "EACH",
    scrapPct: l.scrapPct != null ? String(l.scrapPct) : "",
  }));
}

/** Map a ZodError's nested issues to dotted-path field errors. */
function zodFieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".");
    (out[path] ??= []).push(issue.message);
  }
  return out;
}

/** Serialise the line drafts to the EXACT POST/PATCH `lines` payload. */
function buildLines(lines: LineDraft[]): BomLineInput[] {
  return lines.map((l) => {
    const line: BomLineInput = {
      stockItemId: l.option?.stockItemId ?? l.stockItemId,
      quantity: l.quantity.trim(),
      unit: l.unit,
    };
    const scrap = l.scrapPct.trim();
    if (scrap !== "") line.scrapPct = scrap;
    return line;
  });
}

/** A draft sentinel for the version bar's "new version" pseudo-selection. */
const DRAFT_ID = "__draft__";

/* ------------------------------------------------------------------ *
 * Cost + feasibility + leaf table columns
 * ------------------------------------------------------------------ */

const leafColumns: Column<BomLeaf>[] = [
  {
    key: "name",
    header: "Material",
    render: (l) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{l.name}</span>
        <span className="font-mono text-[0.75rem] text-smoke">{l.sku}</span>
      </div>
    ),
  },
  {
    key: "totalQty",
    header: "Total qty",
    align: "right",
    render: (l) => (
      <span className="font-mono font-bold text-ink">
        {String(Number(l.totalQty.toFixed(4)))}
      </span>
    ),
  },
  {
    key: "uom",
    header: "UoM",
    align: "right",
    render: (l) => <span className="font-mono text-smoke">{l.uom}</span>,
  },
];

const costColumns: Column<BomCostLine>[] = [
  {
    key: "name",
    header: "Item",
    render: (l) => (
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <span className="font-medium text-ink">{l.name}</span>
          <span className="font-mono text-[0.75rem] text-smoke">{l.sku}</span>
        </div>
        {l.isBuilt ? (
          <Badge variant="signal" size="sm">
            Built
          </Badge>
        ) : null}
      </div>
    ),
  },
  {
    key: "qty",
    header: "Qty",
    align: "right",
    render: (l) => (
      <span className="font-mono text-ink">
        {String(Number(l.qty.toFixed(4)))}
      </span>
    ),
  },
  {
    key: "unitStandardCost",
    header: "Unit std cost",
    align: "right",
    render: (l) => (
      <span className="font-mono text-smoke">
        {l.unitStandardCost == null ? "—" : peso(l.unitStandardCost)}
      </span>
    ),
  },
  {
    key: "lineCost",
    header: "Line cost",
    align: "right",
    render: (l) => (
      <span className="font-mono font-bold text-ink">
        {l.lineCost == null ? "—" : peso(l.lineCost)}
      </span>
    ),
  },
];

const shortfallColumns: Column<BomShortfall>[] = [
  {
    key: "name",
    header: "Material",
    render: (s) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{s.name}</span>
        <span className="font-mono text-[0.75rem] text-smoke">{s.sku}</span>
      </div>
    ),
  },
  {
    key: "required",
    header: "Required",
    align: "right",
    render: (s) => (
      <span className="font-mono text-ink">
        {String(Number(s.required.toFixed(4)))}
      </span>
    ),
  },
  {
    key: "available",
    header: "Available",
    align: "right",
    render: (s) => (
      <span className="font-mono text-smoke">
        {String(Number(s.available.toFixed(4)))}
      </span>
    ),
  },
  {
    key: "short",
    header: "Short by",
    align: "right",
    render: (s) => (
      <span className="font-mono font-bold text-soldout">
        {String(Number(s.short.toFixed(4)))}
      </span>
    ),
  },
];

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export function BomEditorPage() {
  const { variantId } = useParams({ strict: false }) as { variantId: string };

  // Variant header info: pull the one matching row from the index (cheap, cached).
  const variantsQuery = useBomVariants({ q: undefined, page: 1, take: 100 });
  const variantRow = variantsQuery.data?.rows.find(
    (r) => r.variantId === variantId,
  );

  const versionsQuery = useBomVersions(variantId);
  const versions = versionsQuery.data ?? [];

  /** The currently-selected version id (or the DRAFT sentinel). */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default the selection to the active version (or the newest) once loaded.
  useEffect(() => {
    if (selectedId !== null) return;
    if (versions.length === 0) return;
    const active = versions.find((v) => v.isActive);
    setSelectedId((active ?? versions[0]).id);
  }, [versions, selectedId]);

  const isDraft = selectedId === DRAFT_ID;
  const loadId = isDraft ? null : selectedId;
  const detailQuery = useBom(loadId);
  const detail = detailQuery.data ?? null;

  // ── Line editor state ──
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Re-hydrate the editor whenever the loaded BOM (or the draft toggle) changes.
  useEffect(() => {
    setFieldErrors({});
    setFormErrors([]);
    if (isDraft) {
      setLines([blankLine()]);
      setNotes("");
      return;
    }
    if (detail) {
      setLines(detail.lines.length > 0 ? linesFromDetail(detail) : [blankLine()]);
      setNotes(detail.notes ?? "");
    }
  }, [detail, isDraft]);

  // ── Mutations ──
  const createBom = useCreateBom();
  const updateBom = useUpdateBom(loadId ?? "");
  const activateBom = useActivateBom();

  function patchLine(key: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormErrors([]);

    const linePayload = buildLines(lines);

    if (isDraft) {
      const payload = {
        variantId,
        notes: notes.trim() || undefined,
        lines: linePayload,
      };
      const parsed = createBomSchema.safeParse(payload);
      if (!parsed.success) {
        setFieldErrors(zodFieldErrors(parsed.error));
        return;
      }
      try {
        const result = await createBom.mutateAsync(parsed.data);
        setSelectedId(result.id);
      } catch (err) {
        applyError(err, "Could not create the BOM version. Try again.");
      }
      return;
    }

    // Editing an existing version.
    const payload = {
      notes: notes.trim() || undefined,
      lines: linePayload,
    };
    const parsed = updateBomSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }
    try {
      await updateBom.mutateAsync(parsed.data);
    } catch (err) {
      applyError(err, "Could not save the BOM. It may be locked by a build.");
    }
  }

  function applyError(err: unknown, fallback: string) {
    const mapped = unwrapFieldErrors(err);
    if (mapped) {
      setFieldErrors(mapped.fieldErrors);
      setFormErrors(
        mapped.formErrors.length > 0 ? mapped.formErrors : [fallback],
      );
    } else {
      setFormErrors([fallback]);
    }
  }

  async function onActivate() {
    if (!loadId) return;
    setFormErrors([]);
    try {
      await activateBom.mutateAsync(loadId);
    } catch (err) {
      applyError(err, "Could not activate this version.");
    }
  }

  const saving = createBom.isPending || updateBom.isPending;
  const selectedVersion: BomVersion | undefined = versions.find(
    (v) => v.id === selectedId,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={variantRow?.title ?? detail?.variantTitle ?? "Bill of Materials"}
        description={
          (variantRow?.sku ?? detail?.variantSku)
            ? `SKU ${variantRow?.sku ?? detail?.variantSku}`
            : "Define a multi-level recipe of materials and sub-assemblies."
        }
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/boms">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Link>
          </Button>
        }
      />

      {/* ── Version bar ── */}
      <div className="flex flex-col gap-3 border-2 border-line bg-paper px-4 py-3 shadow-press">
        <div className="flex items-center justify-between gap-3">
          <span className={labelClass}>Versions</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSelectedId(DRAFT_ID)}
          >
            <Plus className="size-4" aria-hidden="true" />
            New version
          </Button>
        </div>

        {versionsQuery.isLoading ? (
          <p className="font-mono text-[0.75rem] text-smoke">Loading versions…</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {versions.length === 0 && !isDraft ? (
              <p className="font-mono text-[0.75rem] text-smoke">
                No versions yet — start the first with “New version”.
              </p>
            ) : null}

            {versions.map((v) => {
              const active = v.id === selectedId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  aria-pressed={active}
                  className={cn(
                    "cr-press inline-flex items-center gap-2 border-2 border-line px-3 py-1.5 font-mono text-[0.75rem] font-bold uppercase tracking-[0.06em] shadow-press outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ink motion-reduce:transition-none",
                    active
                      ? "bg-signal text-ink"
                      : "bg-paper text-smoke hover:text-ink",
                  )}
                >
                  v{v.version}
                  {v.isActive ? (
                    <Badge variant="stock" size="sm">
                      Active
                    </Badge>
                  ) : null}
                </button>
              );
            })}

            {isDraft ? (
              <span className="inline-flex items-center gap-2 border-2 border-dashed border-line bg-paper-2 px-3 py-1.5 font-mono text-[0.75rem] font-bold uppercase tracking-[0.06em] text-ink">
                New draft
              </span>
            ) : null}
          </div>
        )}

        {/* Activate affordance for the selected, non-active version. */}
        {selectedVersion && !selectedVersion.isActive ? (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={activateBom.isPending}
              onClick={onActivate}
            >
              {activateBom.isPending
                ? "Activating…"
                : `Activate v${selectedVersion.version}`}
            </Button>
            <span className="font-mono text-[0.6875rem] text-smoke">
              Makes this the variant's active BOM.
            </span>
          </div>
        ) : null}
      </div>

      {formErrors.length > 0 ? (
        <div className="border-2 border-soldout bg-soldout/10 px-4 py-3">
          {formErrors.map((m, i) => (
            <p key={i} className="font-mono text-[0.8125rem] text-soldout">
              {m}
            </p>
          ))}
        </div>
      ) : null}

      {/* Nothing selected yet (and no draft): teach. */}
      {selectedId === null ? (
        versionsQuery.isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (
          <EmptyState
            icon={<ListTree className="size-6" aria-hidden="true" />}
            title="No BOM yet"
            description="This variant has no Bill of Materials. Start a new version to add the materials and sub-assemblies it's built from."
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setSelectedId(DRAFT_ID)}
              >
                <Plus className="size-4" aria-hidden="true" />
                New version
              </Button>
            }
          />
        )
      ) : (
        <>
          {/* ── Line editor ── */}
          <Card>
            <CardHeader className="flex-row items-center justify-between border-b-2 border-line">
              <CardTitle>
                {isDraft
                  ? "New version — lines"
                  : `v${detail?.version ?? selectedVersion?.version ?? "?"} — lines`}
              </CardTitle>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setLines((ls) => [...ls, blankLine()])}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add line
              </Button>
            </CardHeader>
            <CardContent className="gap-4 p-4">
              {!isDraft && detailQuery.isLoading ? (
                <TableSkeleton rows={4} cols={4} />
              ) : (
                <form onSubmit={onSave} className="flex flex-col gap-4">
                  <FieldError message={errorFor(fieldErrors, "lines")} />

                  <div className="flex flex-col gap-3">
                    {lines.map((line, i) => {
                      const pickedUom = line.option?.uom ?? null;
                      const label =
                        line.option?.name ??
                        line.existingName ??
                        (line.stockItemId ? "Saved input" : null);
                      return (
                        <div
                          key={line.key}
                          className="grid grid-cols-1 gap-2 border-2 border-line bg-paper p-3 sm:grid-cols-[1fr_7rem_8rem_6rem_auto] sm:items-start"
                        >
                          {/* Picker (or, for a saved input, show its identity + a Change picker) */}
                          <div className="flex flex-col gap-1">
                            {line.option === null && label ? (
                              <div className="flex items-center justify-between gap-2 border-2 border-line bg-paper-2 px-3 py-2">
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate font-mono text-[0.8125rem] text-ink">
                                    {label}
                                  </span>
                                  <span className="truncate font-mono text-[0.6875rem] text-smoke">
                                    {line.existingSku ?? line.stockItemId}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    patchLine(line.key, {
                                      existingName: null,
                                      existingSku: null,
                                      stockItemId: "",
                                    })
                                  }
                                  className="cr-press shrink-0 border-2 border-line bg-paper px-2 py-1 font-mono text-[0.625rem] font-bold uppercase tracking-[0.08em] text-smoke shadow-press outline-none hover:bg-signal hover:text-ink focus-visible:ring-2 focus-visible:ring-ink"
                                >
                                  Change
                                </button>
                              </div>
                            ) : (
                              <StockItemPicker
                                value={line.option}
                                onPick={(opt) =>
                                  patchLine(line.key, {
                                    option: opt,
                                    stockItemId: opt?.stockItemId ?? "",
                                    // Default the unit to the item's UoM when known.
                                    unit:
                                      opt &&
                                      (UNIT_OPTIONS as readonly string[]).includes(
                                        opt.uom,
                                      )
                                        ? (opt.uom as UnitOfMeasure)
                                        : line.unit,
                                  })
                                }
                                invalid={Boolean(
                                  errorFor(fieldErrors, `lines.${i}.stockItemId`),
                                )}
                                aria-label={`Line ${i + 1} stock item`}
                              />
                            )}
                            <FieldError
                              message={errorFor(
                                fieldErrors,
                                `lines.${i}.stockItemId`,
                              )}
                            />
                          </div>

                          {/* Quantity */}
                          <div className="flex flex-col gap-1">
                            <CellInput
                              inputMode="decimal"
                              placeholder={pickedUom ? `Qty (${pickedUom})` : "Qty"}
                              aria-label={`Line ${i + 1} quantity`}
                              value={line.quantity}
                              onChange={(e) =>
                                patchLine(line.key, { quantity: e.target.value })
                              }
                            />
                            <FieldError
                              message={errorFor(fieldErrors, `lines.${i}.quantity`)}
                            />
                          </div>

                          {/* Unit */}
                          <div className="flex flex-col gap-1">
                            <CellSelect
                              aria-label={`Line ${i + 1} unit`}
                              value={line.unit}
                              onChange={(e) =>
                                patchLine(line.key, {
                                  unit: e.target.value as UnitOfMeasure,
                                })
                              }
                            >
                              {UNIT_OPTIONS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </CellSelect>
                            <FieldError
                              message={errorFor(fieldErrors, `lines.${i}.unit`)}
                            />
                          </div>

                          {/* Scrap % */}
                          <div className="flex flex-col gap-1">
                            <CellInput
                              inputMode="decimal"
                              placeholder="Scrap %"
                              aria-label={`Line ${i + 1} scrap percent`}
                              value={line.scrapPct}
                              onChange={(e) =>
                                patchLine(line.key, { scrapPct: e.target.value })
                              }
                            />
                            <FieldError
                              message={errorFor(fieldErrors, `lines.${i}.scrapPct`)}
                            />
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove line ${i + 1}`}
                            disabled={lines.length === 1}
                            onClick={() =>
                              setLines((ls) =>
                                ls.filter((l) => l.key !== line.key),
                              )
                            }
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Notes</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional — revision reason, assembly notes…"
                      className="min-h-[4rem] w-full resize-y border-2 border-line bg-paper px-3 py-2.5 font-mono text-[0.8125rem] text-ink shadow-press outline-none placeholder:text-smoke focus-visible:ring-2 focus-visible:ring-ink"
                    />
                  </label>

                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={saving}
                    >
                      <Save className="size-4" aria-hidden="true" />
                      {saving
                        ? "Saving…"
                        : isDraft
                          ? "Create version"
                          : "Save changes"}
                    </Button>
                    {isDraft ? (
                      <span className="font-mono text-[0.6875rem] text-smoke">
                        Creates a new BOM version for this variant.
                      </span>
                    ) : null}
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Analysis panels need a saved BOM id (a draft has none yet). */}
          {isDraft || !loadId ? (
            <EmptyState
              icon={<Calculator className="size-6" aria-hidden="true" />}
              title="Save to explode, cost and check feasibility"
              description="Explosion, cost rollup and build feasibility run against a saved BOM version. Create this version first, then these panels light up."
            />
          ) : (
            <AnalysisPanels
              bomId={loadId}
              inputs={(detail?.lines ?? []).map((l) => ({
                stockItemId: l.stockItemId,
                name: l.name,
                sku: l.sku,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Analysis panels (explode / cost / feasibility) — own the shared qty
 * ------------------------------------------------------------------ */

interface LineInputRef {
  stockItemId: string;
  name: string;
  sku: string;
}

function AnalysisPanels({
  bomId,
  inputs,
}: {
  bomId: string;
  inputs: LineInputRef[];
}) {
  // A single qty drives explode + cost (so they stay in sync); feasibility has
  // its own qty + warehouse below.
  const [qtyText, setQtyText] = useState("1");
  const qty = useMemo(() => {
    const n = Number(qtyText);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [qtyText]);

  return (
    <div className="flex flex-col gap-6">
      {/* Shared qty for explode + cost */}
      <div className="flex flex-wrap items-end gap-3 border-2 border-line bg-paper px-4 py-3 shadow-press">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Build quantity</span>
          <CellInput
            inputMode="decimal"
            value={qtyText}
            aria-label="Build quantity for explosion and cost"
            onChange={(e) => setQtyText(e.target.value)}
            className="w-32"
          />
        </label>
        <span className="pb-2.5 font-mono text-[0.6875rem] text-smoke">
          Drives the explosion tree and cost rollup below.
        </span>
      </div>

      <ExplosionPanel bomId={bomId} qty={qty} />
      <CostPanel bomId={bomId} qty={qty} />
      <WhereUsedPanel inputs={inputs} />
      <FeasibilityPanel bomId={bomId} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Where-used panel (best-effort, keyed per LINE INPUT)
 *
 * The where-used endpoint is keyed by `stockItemId`. Here we only have the
 * parent `variantId` (not its own stockItemId), so — per the brief — we offer
 * a per-input lookup instead: pick one of this BOM's inputs and see every other
 * BOM that consumes it. Best-effort: a lookup that fails or returns nothing is
 * shown inline and never blocks the page.
 * ------------------------------------------------------------------ */

const whereUsedColumns: Column<BomWhereUsed>[] = [
  {
    key: "product",
    header: "Used in",
    render: (u) => (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{u.productTitle}</span>
        <span className="font-mono text-[0.75rem] text-smoke">
          {u.variantSku} · v{u.version}
        </span>
      </div>
    ),
  },
  {
    key: "isActive",
    header: "Active",
    render: (u) =>
      u.isActive ? (
        <Badge variant="stock" size="sm">
          Active
        </Badge>
      ) : (
        <span className="font-mono text-[0.75rem] text-smoke">—</span>
      ),
  },
  {
    key: "quantity",
    header: "Qty",
    align: "right",
    render: (u) => (
      <span className="font-mono text-ink">
        {String(Number(u.quantity.toFixed(4)))}{" "}
        <span className="text-smoke">{u.unit}</span>
      </span>
    ),
  },
];

function WhereUsedPanel({ inputs }: { inputs: LineInputRef[] }) {
  // De-dupe inputs by stockItemId (a part can appear on multiple lines).
  const unique = useMemo(() => {
    const seen = new Map<string, LineInputRef>();
    for (const i of inputs) if (!seen.has(i.stockItemId)) seen.set(i.stockItemId, i);
    return [...seen.values()];
  }, [inputs]);

  const [selected, setSelected] = useState<string>("");

  // Default to the first input once the lines load.
  useEffect(() => {
    if (selected !== "" || unique.length === 0) return;
    setSelected(unique[0].stockItemId);
  }, [unique, selected]);

  const { data, isLoading, isError } = useBomWhereUsed(selected || null);

  return (
    <Card>
      <CardHeader className="border-b-2 border-line">
        <CardTitle className="flex items-center gap-2">
          <Network className="size-5" aria-hidden="true" />
          Where used
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-4 p-4">
        {unique.length === 0 ? (
          <p className="font-mono text-[0.75rem] text-smoke">
            Add inputs to this BOM to look up where each one is used.
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Input</span>
              <CellSelect
                aria-label="Where-used input"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="min-w-[18rem]"
              >
                {unique.map((i) => (
                  <option key={i.stockItemId} value={i.stockItemId}>
                    {i.name} ({i.sku})
                  </option>
                ))}
              </CellSelect>
            </label>

            {isLoading ? (
              <TableSkeleton rows={2} cols={3} />
            ) : isError ? (
              <p className="font-mono text-[0.75rem] text-smoke">
                Where-used is unavailable for this input.
              </p>
            ) : (
              <DataTable<BomWhereUsed>
                columns={whereUsedColumns}
                rows={data ?? []}
                getRowKey={(u) => u.bomId}
                empty={
                  <div className="px-4 py-8 text-center font-mono text-[0.8125rem] uppercase tracking-[0.08em] text-smoke">
                    This input is not used by any other BOM.
                  </div>
                }
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ExplosionPanel({ bomId, qty }: { bomId: string; qty: number }) {
  const { data, isLoading, isError, error } = useBomExplosion(bomId, qty);

  // A cyclic BOM 409s; surface the backend message clearly.
  const cyclic = unwrapFieldErrors(error);

  return (
    <Card>
      <CardHeader className="border-b-2 border-line">
        <CardTitle className="flex items-center gap-2">
          <ListTree className="size-5" aria-hidden="true" />
          Explosion
          {data ? (
            <Badge variant="neutral" size="sm" className="ml-1">
              depth {data.maxDepth}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-4 p-4">
        {isLoading ? (
          <TableSkeleton rows={4} cols={2} />
        ) : isError ? (
          <div className="border-2 border-soldout bg-soldout/10 px-4 py-3">
            <p className="font-mono text-[0.8125rem] font-bold text-soldout">
              Could not explode this BOM.
            </p>
            <p className="font-mono text-[0.75rem] text-soldout">
              {cyclic?.formErrors[0] ??
                "It may contain a cycle (a part that contains itself). Fix the lines and try again."}
            </p>
          </div>
        ) : data ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className={labelClass}>Component tree</span>
              <BomTree tree={data.tree} />
            </div>

            <div className="flex flex-col gap-2">
              <span className={labelClass}>Flattened leaf totals</span>
              <DataTable<BomLeaf>
                columns={leafColumns}
                rows={data.leaves}
                getRowKey={(l) => l.stockItemId}
                empty={
                  <div className="px-4 py-8 text-center font-mono text-[0.8125rem] uppercase tracking-[0.08em] text-smoke">
                    No leaf materials
                  </div>
                }
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CostPanel({ bomId, qty }: { bomId: string; qty: number }) {
  const { data, isLoading, isError } = useBomCost(bomId, qty);

  return (
    <Card>
      <CardHeader className="border-b-2 border-line">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-5" aria-hidden="true" />
          Cost rollup
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-4 p-4">
        {isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : isError ? (
          <p className="font-mono text-[0.8125rem] text-soldout">
            Could not load the cost rollup. Try again.
          </p>
        ) : data ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border-2 border-line bg-paper-2 px-4 py-3">
                <span className={labelClass}>Unit cost</span>
                <p className="mt-1 font-sans text-[1.75rem] font-bold leading-none tracking-[-0.02em] text-ink">
                  {data.unitCost == null ? "—" : peso(data.unitCost)}
                </p>
              </div>
              <div className="border-2 border-line bg-paper-2 px-4 py-3">
                <span className={labelClass}>
                  Extended cost (× {String(Number(data.qty.toFixed(4)))})
                </span>
                <p className="mt-1 font-sans text-[1.75rem] font-bold leading-none tracking-[-0.02em] text-signal">
                  {data.extendedCost == null ? "—" : peso(data.extendedCost)}
                </p>
              </div>
            </div>

            {data.hasMissingCost ? (
              <div className="border-2 border-hazard bg-hazard/10 px-4 py-2.5">
                <p className="font-mono text-[0.75rem] text-ink">
                  Some inputs have no standard cost — the totals above exclude
                  them and may be understated.
                </p>
              </div>
            ) : null}

            <DataTable<BomCostLine>
              columns={costColumns}
              rows={data.lines}
              getRowKey={(l) => l.stockItemId}
              empty={
                <div className="px-4 py-8 text-center font-mono text-[0.8125rem] uppercase tracking-[0.08em] text-smoke">
                  No cost lines
                </div>
              }
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FeasibilityPanel({ bomId }: { bomId: string }) {
  const [qtyText, setQtyText] = useState("1");
  const [warehouseId, setWarehouseId] = useState("");

  const qty = useMemo(() => {
    const n = Number(qtyText);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [qtyText]);

  const warehousesQuery = useBomWarehouseOptions();
  const warehouses = warehousesQuery.data ?? [];

  // Default to the web-default warehouse (or the first) once options load.
  useEffect(() => {
    if (warehouseId !== "" || warehouses.length === 0) return;
    const def = warehouses.find((w) => w.isDefaultWeb) ?? warehouses[0];
    setWarehouseId(def.id);
  }, [warehouses, warehouseId]);

  const { data, isLoading, isError } = useBomFeasibility(bomId, qty, warehouseId);

  return (
    <Card>
      <CardHeader className="border-b-2 border-line">
        <CardTitle className="flex items-center gap-2">
          <Wrench className="size-5" aria-hidden="true" />
          Build feasibility
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Quantity</span>
            <CellInput
              inputMode="decimal"
              value={qtyText}
              aria-label="Feasibility build quantity"
              onChange={(e) => setQtyText(e.target.value)}
              className="w-28"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Warehouse</span>
            <CellSelect
              aria-label="Feasibility warehouse"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="min-w-[14rem]"
            >
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </CellSelect>
          </label>
        </div>

        {warehouseId === "" ? (
          <p className="font-mono text-[0.75rem] text-smoke">
            Pick a warehouse to check whether its stock can build this BOM.
          </p>
        ) : isLoading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : isError ? (
          <p className="font-mono text-[0.8125rem] text-soldout">
            Could not run feasibility. Try again.
          </p>
        ) : data ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <StatusPill
                kind="stock"
                value={data.canBuild ? "IN_STOCK" : "OUT"}
              />
              <span className="font-mono text-[0.8125rem] text-ink">
                {data.canBuild
                  ? `Can build ${String(Number(data.qty.toFixed(4)))}.`
                  : "Insufficient stock for this quantity."}
              </span>
              <span className="font-mono text-[0.75rem] text-smoke">
                Buildable now:{" "}
                <span className="font-bold text-ink">
                  {String(Number(data.buildableMax.toFixed(4)))}
                </span>
              </span>
            </div>

            {data.shortfalls.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className={labelClass}>Shortfalls</span>
                <DataTable<BomShortfall>
                  columns={shortfallColumns}
                  rows={data.shortfalls}
                  getRowKey={(s) => s.stockItemId}
                />
              </div>
            ) : data.canBuild ? null : (
              <p className="font-mono text-[0.75rem] text-smoke">
                No per-line shortfalls reported.
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
