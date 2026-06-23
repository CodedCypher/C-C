import type * as React from "react";

import { cn } from "~/lib/utils";

/**
 * circuit.rocks admin — DataTable
 *
 * A generic, brutalist table: 2px outer border + hard shadow, a dark carbon
 * header with mono uppercase labels, `border-line` cell separators, paper-2
 * zebra striping, and a subtle signal-tint row hover. Per-column `align`,
 * fixed `width`, and a custom `render` are supported. Horizontal scroll kicks
 * in on narrow screens. When `rows` is empty, the `empty` node (or a default)
 * spans the full width.
 */

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
  render?: (row: T) => React.ReactNode;
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  empty?: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto border-2 border-line shadow-brutal">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-carbon">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  "cr-mono whitespace-nowrap px-3.5 py-3 text-[0.6875rem] font-bold text-paper",
                  alignClass[col.align ?? "left"],
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="bg-paper p-0">
                {empty ?? (
                  <div className="px-4 py-12 text-center font-mono text-[0.8125rem] uppercase tracking-[0.08em] text-smoke">
                    No records found
                  </div>
                )}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="border-t-2 border-line odd:bg-paper even:bg-paper-2 transition-colors duration-150 hover:bg-signal/15 motion-reduce:transition-none"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3.5 py-3 align-middle text-[0.875rem] text-ink",
                      alignClass[col.align ?? "left"],
                    )}
                  >
                    {col.render
                      ? col.render(row)
                      : // Fall back to the raw value at `key` when no renderer.
                        String(
                          (row as Record<string, unknown>)[col.key] ?? "",
                        )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
