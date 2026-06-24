/**
 * circuit.rocks — account feature: saved-addresses CRUD (route /account/addresses).
 *
 * Lists the signed-in shopper's saved delivery addresses as brutalist cards,
 * each with Edit / Delete / "Set default" (hidden on the address that is already
 * default, which instead shows a "Default" badge). "Add address" + "Edit" open
 * the shared <AddressForm>. Wires the storefront address mutations
 * (create / update / delete / set-default), which all invalidate the same
 * `myAddresses` query the list reads.
 */

import { useState } from "react";
import { MapPin, Pencil, Star, Trash2 } from "lucide-react";

import { EmptyState } from "~/components/shared";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  useCreateAddress,
  useDeleteAddress,
  useMyAddresses,
  useSetDefaultAddress,
  useUpdateAddress,
  type CreateAddressInput,
  type SavedAddress,
} from "~/features/storefront";
import { AddressForm } from "../components/address-form";

function AddressLines({ a }: { a: SavedAddress }) {
  return (
    <div className="flex flex-col gap-0.5 font-mono text-[0.8125rem] text-ink">
      <span className="font-bold">{a.name}</span>
      {a.phone ? <span className="text-smoke">☎ {a.phone}</span> : null}
      <span>
        {a.line1}
        {a.line2 ? `, ${a.line2}` : ""}
      </span>
      <span>
        {[a.barangay, a.city, a.province, a.region, a.postalCode]
          .filter(Boolean)
          .join(", ")}
      </span>
      <span>{a.country}</span>
    </div>
  );
}

export function AddressesPage() {
  const { data: addresses, isLoading, isError } = useMyAddresses(true);
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const remove = useDeleteAddress();
  const setDefault = useSetDefaultAddress();

  // null = closed; "new" = create form; otherwise the id being edited.
  const [editing, setEditing] = useState<"new" | string | null>(null);

  const editingAddress =
    editing && editing !== "new"
      ? addresses?.find((a) => a.id === editing)
      : undefined;

  async function handleCreate(body: CreateAddressInput) {
    await create.mutateAsync(body);
    setEditing(null);
  }

  async function handleUpdate(id: string, body: CreateAddressInput) {
    await update.mutateAsync({ id, body });
    setEditing(null);
  }

  if (isLoading) {
    return (
      <p className="font-mono text-[0.8125rem] text-smoke">
        Loading your addresses…
      </p>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<MapPin className="size-6" aria-hidden="true" />}
        title="Could not load your addresses"
        description="Something went wrong fetching your saved addresses. Try again."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-[1.25rem] font-bold tracking-[-0.01em] text-ink">
          Saved addresses
        </h2>
        {editing === null ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setEditing("new")}
          >
            Add address
          </Button>
        ) : null}
      </div>

      {/* Create form */}
      {editing === "new" ? (
        <AddressForm
          submitting={create.isPending}
          onSubmit={handleCreate}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {(addresses?.length ?? 0) === 0 && editing === null ? (
        <EmptyState
          icon={<MapPin className="size-6" aria-hidden="true" />}
          title="No saved addresses"
          description="Add a delivery address to speed up checkout next time."
          action={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setEditing("new")}
            >
              Add address
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(addresses ?? []).map((a) =>
            editing === a.id && editingAddress ? (
              <div key={a.id} className="sm:col-span-2">
                <AddressForm
                  initial={editingAddress}
                  submitting={update.isPending}
                  onSubmit={(body) => handleUpdate(a.id, body)}
                  onCancel={() => setEditing(null)}
                />
              </div>
            ) : (
              <Card key={a.id}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">{a.city}</CardTitle>
                  {a.isDefault ? (
                    <Badge variant="signal" size="sm">
                      Default
                    </Badge>
                  ) : null}
                </CardHeader>
                <CardContent className="gap-4">
                  <AddressLines a={a} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditing(a.id)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </Button>
                    {!a.isDefault ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={setDefault.isPending}
                        onClick={() => setDefault.mutate(a.id)}
                      >
                        <Star className="size-4" aria-hidden="true" />
                        Set default
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (
                          window.confirm("Delete this saved address?")
                        ) {
                          remove.mutate(a.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
