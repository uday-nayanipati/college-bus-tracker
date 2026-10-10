"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Pencil, Plus, Route as RouteIcon, Search, Trash2 } from "lucide-react";
import { deleteRoute, saveRoute, type ActionState } from "@/app/(admin)/actions";
import type { Route } from "@/types/database";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { Alert, Button, Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";

export function RouteManager({
  routes,
  busCountByRoute,
}: {
  routes: Route[];
  busCountByRoute: Record<string, number>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Route | "new" | null>(null);
  const [deleting, setDeleting] = useState<Route | null>(null);
  const [feedback, setFeedback] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = routes.filter(
    (r) =>
      !q ||
      r.route_name.toLowerCase().includes(q) ||
      r.start_point.toLowerCase().includes(q) ||
      r.end_point.toLowerCase().includes(q),
  );

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteRoute(deleting.id);
      setDeleting(null);
      setFeedback(result);
      router.refresh();
    });
  };

  return (
    <>
      <PageHeader
        title="Routes"
        description="Routes describe where a bus goes. Buses take their default route from here."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden className="size-4" /> New route
          </Button>
        }
      />

      {feedback ? (
        <Alert tone={feedback.error ? "error" : "success"} className="mb-4">
          {feedback.error ?? feedback.message}
        </Alert>
      ) : null}

      {routes.length > 0 ? (
        <div className="relative mb-4">
          <Label htmlFor="route-search" className="sr-only">
            Search routes
          </Label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 mt-0.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="route-search"
            type="search"
            placeholder="Search routes or stops"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      ) : null}

      {routes.length === 0 ? (
        <EmptyState icon={<RouteIcon className="size-8" />} title="No routes yet">
          Create a route, then assign it to buses.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="No routes match your search" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((route) => {
            const busCount = busCountByRoute[route.id] ?? 0;
            return (
              <li key={route.id}>
                <Card className="flex h-full flex-col p-4">
                  <p className="font-semibold text-slate-900">{route.route_name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-600">
                    <span className="break-words">{route.start_point}</span>
                    <ArrowRight aria-label="to" className="size-4 shrink-0" />
                    <span className="break-words">{route.end_point}</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {busCount === 1 ? "1 bus" : `${busCount} buses`} on this route
                  </p>
                  <div className="mt-auto flex gap-2 pt-3">
                    <Button variant="secondary" className="flex-1" onClick={() => setEditing(route)}>
                      <Pencil aria-hidden className="size-4" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-red-700"
                      onClick={() => setDeleting(route)}
                      aria-label={`Delete ${route.route_name}`}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New route" : "Edit route"}
      >
        {editing !== null ? (
          <RouteForm
            key={editing === "new" ? "new" : editing.id}
            route={editing === "new" ? null : editing}
            onSaved={(message) => {
              setEditing(null);
              setFeedback({ ok: true, message });
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.route_name ?? "route"}?`}
        message={
          deleting && busCountByRoute[deleting.id]
            ? `${busCountByRoute[deleting.id]} bus(es) use this route and will be left without one. Past trips keep their history.`
            : "This permanently removes the route. Past trips keep their history."
        }
        confirmLabel="Delete route"
        pending={pending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function RouteForm({ route, onSaved }: { route: Route | null; onSaved: (message: string) => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await saveRoute(prev, formData);
    if (result.ok) onSaved(result.message ?? "Saved.");
    return result;
  }, {});

  return (
    <form action={action} className="space-y-4">
      {route ? <input type="hidden" name="id" value={route.id} /> : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div>
        <Label htmlFor="route_name">Route name</Label>
        <Input id="route_name" name="route_name" required maxLength={120} defaultValue={route?.route_name} placeholder="e.g. Route D - West Side" />
      </div>
      <div>
        <Label htmlFor="start_point">Start point</Label>
        <Input id="start_point" name="start_point" required maxLength={200} defaultValue={route?.start_point} />
      </div>
      <div>
        <Label htmlFor="end_point">End point</Label>
        <Input id="end_point" name="end_point" required maxLength={200} defaultValue={route?.end_point} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : null}
        {route ? "Save changes" : "Create route"}
      </Button>
    </form>
  );
}
