/**
 * circuit.rocks — transfers feature: create page (route /transfers/new).
 *
 * A dedicated route (not a modal — modals are last resort) for building a draft
 * transfer: source + destination warehouse, optional notes, and a line builder
 * (stock-item picker via /inventory/options + a 4dp quantity each). Submits to
 * POST /stock-transfers; client-validates with the zod schema first, then maps
 * any backend 400/409 field errors (dotted paths like `lines.0.quantity`) back
 * onto the controls via `unwrapFieldErrors`.
 */

import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "~/components/shared";
import { Button } from "~/components/ui/button";
import { unwrapFieldErrors } from "~/lib/axios";
import { useCreateTransfer } from "../hooks/use-create-transfer";
import { useTransferWarehouseOptions } from "../hooks/use-transfer-warehouse-options";
import { StockItemPicker } from "../components/stock-item-picker";
import {
  FieldError,
  SelectField,
  TextAreaField,
  CellInput,
  errorFor,
  labelClass,
  type FieldErrors,
} from "../components/fields";
import {
  createTransferSchema,
  type StockItemOption,
} from "../types/transfers.types";

interface LineDraft {
  key: number;
  option: StockItemOption | null;
  quantity: string;
}

let lineSeq = 0;
const newLine = (): LineDraft => ({ key: ++lineSeq, option: null, quantity: "" });

/** Map a ZodError's nested issues to dotted-path field errors. */
function zodFieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".");
    (out[path] ??= []).push(issue.message);
  }
  return out;
}

export function TransferNewPage() {
  const navigate = useNavigate();
  const { data: warehouses } = useTransferWarehouseOptions();
  const create = useCreateTransfer();

  const [sourceWarehouseId, setSource] = useState("");
  const [destWarehouseId, setDest] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const whOptions = warehouses ?? [];

  function patchLine(key: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormErrors([]);

    const payload = {
      sourceWarehouseId,
      destWarehouseId,
      notes: notes.trim() || undefined,
      lines: lines.map((l) => ({
        stockItemId: l.option?.stockItemId ?? "",
        quantity: l.quantity.trim(),
      })),
    };

    const parsed = createTransferSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    try {
      const result = await create.mutateAsync(parsed.data);
      await navigate({
        to: "/transfers/$transferId",
        params: { transferId: result.id },
      });
    } catch (err) {
      const mapped = unwrapFieldErrors(err);
      if (mapped) {
        setFieldErrors(mapped.fieldErrors);
        setFormErrors(mapped.formErrors);
      } else {
        setFormErrors(["Could not create the transfer. Try again."]);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New Transfer"
        description="Move stock from a source warehouse to a destination. Creates a draft you can then request, ship and receive."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/transfers">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Link>
          </Button>
        }
      />

      <form className="flex max-w-3xl flex-col gap-6" onSubmit={onSubmit}>
        {formErrors.length > 0 ? (
          <div className="border-2 border-soldout bg-soldout/10 px-4 py-3">
            {formErrors.map((m, i) => (
              <p key={i} className="font-mono text-[0.8125rem] text-soldout">
                {m}
              </p>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Source warehouse"
            path="sourceWarehouseId"
            errors={fieldErrors}
            value={sourceWarehouseId}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Select source…</option>
            {whOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Destination warehouse"
            path="destWarehouseId"
            errors={fieldErrors}
            value={destWarehouseId}
            onChange={(e) => setDest(e.target.value)}
          >
            <option value="">Select destination…</option>
            {whOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </SelectField>
        </div>

        <TextAreaField
          label="Notes"
          path="notes"
          errors={fieldErrors}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional — reason, reference, handling notes…"
        />

        {/* Line builder */}
        <div className="flex flex-col gap-3 border-2 border-line bg-paper-2 p-4 shadow-press">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Lines</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setLines((ls) => [...ls, newLine()])}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add line
            </Button>
          </div>

          <FieldError message={errorFor(fieldErrors, "lines")} />

          <div className="flex flex-col gap-3">
            {lines.map((line, i) => (
              <div
                key={line.key}
                className="grid grid-cols-1 gap-2 border-2 border-line bg-paper p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-start"
              >
                <div className="flex flex-col gap-1">
                  <StockItemPicker
                    value={line.option}
                    onPick={(opt) => patchLine(line.key, { option: opt })}
                    invalid={Boolean(errorFor(fieldErrors, `lines.${i}.stockItemId`))}
                    aria-label={`Line ${i + 1} stock item`}
                  />
                  <FieldError
                    message={errorFor(fieldErrors, `lines.${i}.stockItemId`)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <CellInput
                    inputMode="decimal"
                    placeholder={line.option ? `Qty (${line.option.uom})` : "Qty"}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove line ${i + 1}`}
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((ls) => ls.filter((l) => l.key !== line.key))
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" size="md" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create transfer"}
          </Button>
          <Button asChild variant="ghost" size="md">
            <Link to="/transfers">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
