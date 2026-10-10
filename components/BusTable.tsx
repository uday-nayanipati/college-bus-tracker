"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bus as BusIcon, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deleteBus, saveBus, type ActionState } from "@/app/(admin)/actions";
import type { BusWithRelations } from "@/lib/queries";
import type { BusStatus, Route } from "@/types/database";
import { ConfirmDialog, Modal } from "./Modal";
import { BusStatusBadge } from "./StatusBadge";
import { Alert, Button, Card, EmptyState, Input, Label, PageHeader, Select } from "./ui";

const STATUS_OPTIONS: { value: BusStatus; label: string }[] = [
  { value: "active", label: "In service" },
  { value: "maintenance", label: "Maintenance" },
  { value: "inactive", label: "Inactive (hidden from students)" },
];

export function BusManager({ buses, routes }: { buses: BusWithRelations[]; routes: Route[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | BusStatus>("");
  const [editing, setEditing] = useState<BusWithRelations | "new" | null>(null);
  const [deleting, setDeleting] = useState<BusWithRelations | null>(null);
  const [feedback, setFeedback] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = buses.filter(
    (b) =>
      (!status || b.status === status) &&
      (!q ||
        b.bus_number.toLowerCase().includes(q) ||
        b.route?.route_name.toLowerCase().includes(q) ||
        b.driver?.full_name.toLowerCase().includes(q)),
  );

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteBus(deleting.id);
      setDeleting(null);
      setFeedback(result);
      router.refresh();
    });
  };

  return (
    <>
      <PageHeader
        title="Buses"
        description="Add buses, set their default route and service status. Assign drivers on the Drivers page."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden className="size-4" /> Add bus
          </Button>
        }
      />

      {feedback ? (
        <Alert tone={feedback.error ? "error" : "success"} className="mb-4">
          {feedback.error ?? feedback.message}
        </Alert>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Label htmlFor="bus-search" className="sr-only">
            Search buses
          </Label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 mt-0.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="bus-search"
            type="search"
            placeholder="Search by bus number, route or driver"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="sm:w-56">
          <Label htmlFor="bus-status-filter" className="sr-only">
            Filter by status
          </Label>
          <Select
            id="bus-status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | BusStatus)}
          >
            <option value="">All statuses</option>
            <option value="active">In service</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </div>

      {buses.length === 0 ? (
        <EmptyState icon={<BusIcon className="size-8" />} title="No buses yet">
          Add your first bus to get started.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="No buses match your search" />
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {filtered.map((bus) => (
              <li key={bus.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{bus.bus_number}</p>
                      <p className="truncate text-sm text-slate-600">{bus.route?.route_name ?? "No route"}</p>
                    </div>
                    <BusStatusBadge status={bus.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                    <dt className="text-slate-500">Driver</dt>
                    <dd className="truncate text-slate-900">{bus.driver?.full_name || "Unassigned"}</dd>
                    <dt className="text-slate-500">Capacity</dt>
                    <dd className="text-slate-900">{bus.capacity} seats</dd>
                  </dl>
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => setEditing(bus)}>
                      <Pencil aria-hidden className="size-4" /> Edit
                    </Button>
                    <Button variant="ghost" className="text-red-700" onClick={() => setDeleting(bus)} aria-label={`Delete ${bus.bus_number}`}>
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Bus</th>
                  <th scope="col" className="px-4 py-3">Route</th>
                  <th scope="col" className="px-4 py-3">Driver</th>
                  <th scope="col" className="px-4 py-3">Capacity</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((bus) => (
                  <tr key={bus.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{bus.bus_number}</td>
                    <td className="px-4 py-3 text-slate-700">{bus.route?.route_name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{bus.driver?.full_name || <span className="text-slate-400">Unassigned</span>}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{bus.capacity}</td>
                    <td className="px-4 py-3"><BusStatusBadge status={bus.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" onClick={() => setEditing(bus)}>
                          <Pencil aria-hidden className="size-4" /> Edit
                        </Button>
                        <Button variant="ghost" className="text-red-700" onClick={() => setDeleting(bus)} aria-label={`Delete ${bus.bus_number}`}>
                          <Trash2 aria-hidden className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add bus" : `Edit ${editing?.bus_number ?? "bus"}`}
      >
        {editing !== null ? (
          <BusForm
            key={editing === "new" ? "new" : editing.id}
            bus={editing === "new" ? null : editing}
            routes={routes}
            onSaved={(message) => {
              setEditing(null);
              setFeedback({ ok: true, message });
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.bus_number ?? "bus"}?`}
        message="This permanently removes the bus. Buses with trip history cannot be deleted; set them to Inactive instead."
        confirmLabel="Delete bus"
        pending={pending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function BusForm({
  bus,
  routes,
  onSaved,
}: {
  bus: BusWithRelations | null;
  routes: Route[];
  onSaved: (message: string) => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await saveBus(prev, formData);
    if (result.ok) onSaved(result.message ?? "Saved.");
    return result;
  }, {});

  return (
    <form action={action} className="space-y-4">
      {bus ? <input type="hidden" name="id" value={bus.id} /> : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div>
        <Label htmlFor="bus_number">Bus number</Label>
        <Input id="bus_number" name="bus_number" required maxLength={40} defaultValue={bus?.bus_number} placeholder="e.g. BUS-07" autoCapitalize="characters" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="capacity">Capacity (seats)</Label>
          <Input id="capacity" name="capacity" type="number" inputMode="numeric" min={1} max={200} required defaultValue={bus?.capacity ?? 40} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={bus?.status ?? "active"}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="route_id">Route</Label>
        <Select id="route_id" name="route_id" defaultValue={bus?.route_id ?? ""}>
          <option value="">No route</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.route_name}
            </option>
          ))}
        </Select>
        {routes.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">Create routes on the Routes page first.</p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : null}
        {bus ? "Save changes" : "Add bus"}
      </Button>
    </form>
  );
}
