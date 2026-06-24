/**
 * circuit.rocks — payment-methods feature: list page.
 *
 * Lists the admin-managed payment methods (no pagination — the endpoint returns
 * a plain array). A "New method" header action opens the create Sheet; each row
 * opens the edit Sheet (where the QR image is managed) or can be deleted.
 */

import { useState } from "react";
import { CreditCard, Plus } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  TableSkeleton,
  type Column,
} from "~/components/shared";
import { Button } from "~/components/ui/button";
import {
  usePaymentMethods,
  useDeletePaymentMethod,
} from "../hooks/use-payment-methods";
import type { PaymentMethod } from "../types/payment-methods.types";
import { PaymentMethodFormSheet } from "../components/payment-method-form-sheet";

export function PaymentMethodsListPage() {
  const { data, isLoading, isError } = usePaymentMethods();
  const del = useDeletePaymentMethod();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);

  function handleDelete(m: PaymentMethod) {
    if (window.confirm(`Delete "${m.name}"? This cannot be undone.`)) {
      del.mutate(m.id);
    }
  }

  const columns: Column<PaymentMethod>[] = [
    {
      key: "name",
      header: "Name",
      render: (m) => (
        <button
          type="button"
          onClick={() => setEditing(m)}
          className="font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ink"
        >
          {m.name}
        </button>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (m) => (
        <span
          className={`inline-block border-2 px-2 py-0.5 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.06em] ${
            m.isActive
              ? "border-stock text-stock"
              : "border-line text-smoke"
          }`}
        >
          {m.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "qrImageUrl",
      header: "QR",
      render: (m) =>
        m.qrImageUrl ? (
          <span className="text-ink">Yes</span>
        ) : (
          <span className="font-mono text-[0.75rem] text-smoke">—</span>
        ),
    },
    {
      key: "sortOrder",
      header: "Order",
      render: (m) => (
        <span className="font-mono text-[0.8125rem] text-ink">
          {m.sortOrder}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (m) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(m)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(m)}
            disabled={del.isPending}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payment methods"
        description="Manual payment options shown to shoppers at checkout. Add a QR image so buyers can scan to pay."
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New method
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <EmptyState
          icon={<CreditCard className="h-7 w-7 text-smoke" strokeWidth={1.5} />}
          title="Could not load payment methods"
          description="Something went wrong fetching the list. Try again."
        />
      ) : (
        <DataTable<PaymentMethod>
          columns={columns}
          rows={data ?? []}
          getRowKey={(m) => m.id}
          empty={
            <EmptyState
              icon={<CreditCard className="h-7 w-7 text-smoke" strokeWidth={1.5} />}
              title="No payment methods yet"
              description="Add your first payment method so shoppers can pay at checkout."
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  New method
                </Button>
              }
            />
          }
        />
      )}

      <PaymentMethodFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
      <PaymentMethodFormSheet
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        mode="edit"
        initial={editing ?? undefined}
      />
    </div>
  );
}
