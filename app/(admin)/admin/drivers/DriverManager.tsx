"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleDot, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { assignDriver, setUserRole, type ActionState } from "@/app/(admin)/actions";
import type { BusWithRelations } from "@/lib/queries";
import type { Profile } from "@/types/database";
import { ConfirmDialog } from "@/components/Modal";
import { Alert, Button, Card, EmptyState, Input, Label, PageHeader, Select } from "@/components/ui";

type PendingConfirm =
  | { kind: "promote"; user: Profile }
  | { kind: "demote"; user: Profile }
  | null;

export function DriverManager({
  drivers,
  students,
  buses,
  activeDriverIds,
}: {
  drivers: Profile[];
  students: Profile[];
  buses: BusWithRelations[];
  activeDriverIds: string[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<ActionState | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const onTrip = new Set(activeDriverIds);
  const busByDriver = new Map(buses.filter((b) => b.driver_id).map((b) => [b.driver_id!, b]));

  const run = (id: string, fn: () => Promise<ActionState>) => {
    setBusyId(id);
    startTransition(async () => {
      const result = await fn();
      setFeedback(result);
      setConfirm(null);
      setBusyId(null);
      router.refresh();
    });
  };

  const q = studentQuery.trim().toLowerCase();
  const matchingStudents = q
    ? students
        .filter((s) => s.full_name.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q))
        .slice(0, 20)
    : [];

  return (
    <>
      <PageHeader
        title="Drivers"
        description="Give users driver access and assign each driver to one bus."
      />

      {feedback ? (
        <Alert tone={feedback.error ? "error" : "success"} className="mb-4">
          {feedback.error ?? feedback.message}
        </Alert>
      ) : null}

      <section aria-labelledby="drivers-heading">
        <h2 id="drivers-heading" className="mb-3 text-lg font-bold text-slate-900">
          Drivers ({drivers.length})
        </h2>
        {drivers.length === 0 ? (
          <EmptyState icon={<Users className="size-8" />} title="No drivers yet">
            Drivers sign up like students. Find them below and give them driver access.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {drivers.map((driver) => {
              const bus = busByDriver.get(driver.id);
              const active = onTrip.has(driver.id);
              const busy = pending && busyId === driver.id;
              return (
                <li key={driver.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{driver.full_name || "Unnamed"}</p>
                        <p className="truncate text-sm text-slate-600">{driver.email ?? "—"}</p>
                      </div>
                      {active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-100">
                          <CircleDot aria-hidden className="size-3.5 animate-pulse" /> On trip
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <Label htmlFor={`bus-${driver.id}`}>Assigned bus</Label>
                      <Select
                        id={`bus-${driver.id}`}
                        value={bus?.id ?? ""}
                        disabled={active || busy}
                        onChange={(e) => {
                          const busId = e.target.value || null;
                          run(driver.id, () => assignDriver(driver.id, busId));
                        }}
                      >
                        <option value="">Not assigned</option>
                        {buses.map((b) => {
                          const takenBy = b.driver_id && b.driver_id !== driver.id ? b.driver : null;
                          return (
                            <option key={b.id} value={b.id} disabled={Boolean(takenBy) || b.status === "inactive"}>
                              {b.bus_number}
                              {b.route ? ` · ${b.route.route_name}` : ""}
                              {takenBy ? ` (assigned to ${takenBy.full_name || "another driver"})` : ""}
                              {b.status !== "active" ? ` (${b.status})` : ""}
                            </option>
                          );
                        })}
                      </Select>
                      {active ? (
                        <p className="mt-1 text-xs text-slate-500">Can’t change the bus during an active trip.</p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        className="text-red-700"
                        disabled={active || busy}
                        onClick={() => setConfirm({ kind: "demote", user: driver })}
                      >
                        <UserMinus aria-hidden className="size-4" /> Remove driver access
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="promote-heading" className="mt-10">
        <h2 id="promote-heading" className="text-lg font-bold text-slate-900">
          Add a driver
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Ask the driver to create an account on the sign-up page, then find them here.
        </p>
        <div className="relative mt-3">
          <Label htmlFor="student-search" className="sr-only">
            Search users by name or email
          </Label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 mt-0.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="student-search"
            type="search"
            placeholder="Search users by name or email"
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {q ? (
          matchingStudents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No matching users.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
              {matchingStudents.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{s.full_name || "Unnamed"}</p>
                    <p className="truncate text-sm text-slate-600">{s.email ?? "—"}</p>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={pending && busyId === s.id}
                    onClick={() => setConfirm({ kind: "promote", user: s })}
                  >
                    <UserPlus aria-hidden className="size-4" /> Make driver
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "promote" ? "Give driver access?" : "Remove driver access?"}
        message={
          confirm?.kind === "promote" ? (
            <>
              <strong>{confirm.user.full_name || confirm.user.email}</strong> will be able to start trips and share
              location for the bus you assign them.
            </>
          ) : (
            <>
              <strong>{confirm?.user.full_name || confirm?.user.email}</strong> will become a student account and
              be unassigned from their bus.
            </>
          )
        }
        confirmLabel={confirm?.kind === "promote" ? "Make driver" : "Remove access"}
        tone={confirm?.kind === "promote" ? "primary" : "danger"}
        pending={pending}
        onConfirm={() => {
          if (!confirm) return;
          const role = confirm.kind === "promote" ? "driver" : "student";
          run(confirm.user.id, () => setUserRole(confirm.user.id, role));
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
