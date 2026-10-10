// Runs the real migration against an in-process Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema and roles, then exercises the
// RLS policies and RPCs as different users.
//
// This verifies the SQL logic, not Supabase itself: run the manual checks in
// README.md against your real project as well.
//
// Run: npm run test:db

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite();

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create publication supabase_realtime;
`;

const ids = {};

async function createUser(name, meta = {}) {
  const { rows } = await db.query(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [`${name}@example.test`, JSON.stringify(meta)],
  );
  return rows[0].id;
}

/** Run `fn` as an authenticated user (or anon when uid is null). */
async function as(uid, fn) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec(uid ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function rejects(promise, pattern) {
  await assert.rejects(promise, (err) => {
    if (pattern) assert.match(String(err.message), pattern);
    return true;
  });
}

before(async () => {
  await db.exec(SUPABASE_STUB);
  const migrations = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    await db.exec(readFileSync(join(root, "migrations", file), "utf8"));
  }
  await db.exec(readFileSync(join(root, "seed.sql"), "utf8"));

  ids.admin = await createUser("admin", { full_name: "Admin" });
  ids.driver = await createUser("driver", { full_name: "Driver One" });
  ids.driver2 = await createUser("driver2", { full_name: "Driver Two" });
  ids.student = await createUser("student", { full_name: "Student", role: "admin" });

  // Trusted provisioning (no auth.uid()), as in the SQL editor.
  await db.query("update public.profiles set role = 'admin' where id = $1", [ids.admin]);
  await db.query("update public.profiles set role = 'driver' where id = any($1)", [[ids.driver, ids.driver2]]);

  const { rows } = await db.query("select id, bus_number from public.buses order by bus_number");
  for (const r of rows) ids[r.bus_number] = r.id;
});

test("sign-up always creates a student profile, ignoring metadata role", async () => {
  const { rows } = await db.query("select role, full_name from public.profiles where id = $1", [ids.student]);
  assert.equal(rows[0].role, "student");
  assert.equal(rows[0].full_name, "Student");
});

test("anon cannot read any application table", async () => {
  for (const table of ["profiles", "routes", "buses", "trips", "bus_locations"]) {
    await as(null, () => rejects(db.query(`select * from public.${table}`), /permission denied/));
  }
});

test("users cannot promote themselves", async () => {
  await as(ids.student, () =>
    rejects(db.query("update public.profiles set role = 'admin' where id = $1", [ids.student]), /only admins/),
  );
  await as(ids.driver, () =>
    rejects(db.query("update public.profiles set role = 'admin' where id = $1", [ids.driver]), /only admins/),
  );
  // Users can still edit their own name.
  await as(ids.student, () =>
    db.query("update public.profiles set full_name = 'Renamed' where id = $1", [ids.student]),
  );
});

test("admins cannot grant or revoke admin through the API", async () => {
  await as(ids.admin, () =>
    rejects(db.query("update public.profiles set role = 'admin' where id = $1", [ids.student]), /trusted process/),
  );
  await as(ids.admin, () =>
    rejects(db.query("update public.profiles set role = 'student' where id = $1", [ids.admin]), /trusted process/),
  );
});

test("students see only their own profile; admins see all", async () => {
  const own = await as(ids.student, () => db.query("select id from public.profiles"));
  assert.deepEqual(own.rows.map((r) => r.id), [ids.student]);
  const all = await as(ids.admin, () => db.query("select id from public.profiles"));
  assert.equal(all.rows.length, 4);
});

test("only admins can write buses and routes", async () => {
  await as(ids.student, () =>
    rejects(db.query("insert into public.buses (bus_number, capacity) values ('X', 10)"), /row-level security/),
  );
  await as(ids.driver, () =>
    rejects(db.query("insert into public.routes (route_name, start_point, end_point) values ('R', 'a', 'b')"), /row-level security/),
  );
  const upd = await as(ids.student, () => db.query("update public.buses set capacity = 1 returning id"));
  assert.equal(upd.rows.length, 0, "student update must affect no rows");

  await as(ids.admin, () => db.query("insert into public.buses (bus_number, capacity) values ('BUS-99', 30)"));
  await as(ids.admin, () => db.query("delete from public.buses where bus_number = 'BUS-99'"));
});

test("students do not see inactive buses", async () => {
  await db.query("insert into public.buses (bus_number, capacity, status) values ('BUS-OLD', 20, 'inactive')");
  const s = await as(ids.student, () => db.query("select bus_number from public.buses"));
  assert.ok(!s.rows.some((r) => r.bus_number === "BUS-OLD"));
  const a = await as(ids.admin, () => db.query("select bus_number from public.buses"));
  assert.ok(a.rows.some((r) => r.bus_number === "BUS-OLD"));
});

test("only users with the driver role can be assigned to a bus", async () => {
  await as(ids.admin, () =>
    rejects(
      db.query("update public.buses set driver_id = $1 where id = $2", [ids.student, ids["BUS-01"]]),
      /driver role/,
    ),
  );
  await as(ids.admin, () =>
    db.query("update public.buses set driver_id = $1 where id = $2", [ids.driver, ids["BUS-01"]]),
  );
  // One bus per driver.
  await as(ids.admin, () =>
    rejects(db.query("update public.buses set driver_id = $1 where id = $2", [ids.driver, ids["BUS-02"]]), /duplicate key/),
  );
  await as(ids.admin, () =>
    db.query("update public.buses set driver_id = $1 where id = $2", [ids.driver2, ids["BUS-02"]]),
  );
});

test("trips cannot be written directly", async () => {
  await as(ids.driver, () =>
    rejects(
      db.query("insert into public.trips (bus_id, driver_id) values ($1, $2)", [ids["BUS-01"], ids.driver]),
      /permission denied/,
    ),
  );
  await as(ids.driver, () =>
    rejects(
      db.query("insert into public.bus_locations (bus_id, latitude, longitude) values ($1, 1, 1)", [ids["BUS-01"]]),
      /permission denied/,
    ),
  );
});

test("drivers can only start trips on their assigned, in-service bus", async () => {
  await as(ids.student, () => rejects(db.query("select public.start_trip($1)", [ids["BUS-01"]]), /only drivers/));
  await as(ids.driver, () => rejects(db.query("select public.start_trip($1)", [ids["BUS-02"]]), /not assigned/));

  // BUS-03 is under maintenance.
  await as(ids.admin, () => db.query("update public.buses set driver_id = null where id = $1", [ids["BUS-02"]]));
  await as(ids.admin, () =>
    db.query("update public.buses set driver_id = $1 where id = $2", [ids.driver2, ids["BUS-03"]]),
  );
  await as(ids.driver2, () => rejects(db.query("select public.start_trip($1)", [ids["BUS-03"]]), /not in service/));
  await as(ids.admin, () => db.query("update public.buses set driver_id = null where id = $1", [ids["BUS-03"]]));
  await as(ids.admin, () =>
    db.query("update public.buses set driver_id = $1 where id = $2", [ids.driver2, ids["BUS-02"]]),
  );
});

test("trip lifecycle: start, conflict, location updates, end", async () => {
  const { rows } = await as(ids.driver, () => db.query("select * from public.start_trip($1)", [ids["BUS-01"]]));
  const trip = rows[0];
  assert.equal(trip.status, "active");
  assert.equal(trip.driver_id, ids.driver);

  // Second start on the same bus is rejected.
  await as(ids.driver, () => rejects(db.query("select public.start_trip($1)", [ids["BUS-01"]]), /already has an active trip/));

  // Driver cannot be reassigned during an active trip.
  await as(ids.admin, () =>
    rejects(db.query("update public.buses set driver_id = null where id = $1", [ids["BUS-01"]]), /active trip/),
  );

  // Invalid coordinates are rejected.
  for (const [lat, lng] of [[91, 0], [0, 181], [0, 0], ["NaN", 10]]) {
    await as(ids.driver, () =>
      rejects(db.query("select public.update_bus_location($1, $2, $3, 5)", [ids["BUS-01"], lat, lng]), /invalid coordinates/),
    );
  }

  // Other drivers and students cannot publish this bus's location.
  await as(ids.driver2, () =>
    rejects(db.query("select public.update_bus_location($1, 12.97, 77.59, 5)", [ids["BUS-01"]]), /no active trip/),
  );
  await as(ids.student, () =>
    rejects(db.query("select public.update_bus_location($1, 12.97, 77.59, 5)", [ids["BUS-01"]]), /no active trip/),
  );

  const ok = await as(ids.driver, () =>
    db.query("select public.update_bus_location($1, 12.97, 77.59, 8) as ok", [ids["BUS-01"]]),
  );
  assert.equal(ok.rows[0].ok, true);

  // Throttled when called again immediately.
  const throttled = await as(ids.driver, () =>
    db.query("select public.update_bus_location($1, 12.98, 77.60, 8) as ok", [ids["BUS-01"]]),
  );
  assert.equal(throttled.rows[0].ok, false);

  // Students can read the location and the active trip.
  const loc = await as(ids.student, () => db.query("select latitude, trip_id from public.bus_locations"));
  assert.equal(loc.rows.length, 1);
  assert.equal(loc.rows[0].trip_id, trip.id);
  const active = await as(ids.student, () => db.query("select id from public.trips where status = 'active'"));
  assert.equal(active.rows.length, 1);

  // Another driver cannot end it.
  await as(ids.driver2, () => rejects(db.query("select public.end_trip($1)", [trip.id]), /trip not found/));

  const ended = await as(ids.driver, () => db.query("select * from public.end_trip($1)", [trip.id]));
  assert.equal(ended.rows[0].status, "completed");
  assert.ok(ended.rows[0].ended_at);

  // The location row is kept but detached from the trip (Realtime signal for students).
  const detached = await as(ids.student, () => db.query("select trip_id from public.bus_locations"));
  assert.equal(detached.rows.length, 1);
  assert.equal(detached.rows[0].trip_id, null);

  // Location updates stop being accepted after the trip ends.
  await db.query("update public.bus_locations set updated_at = now() - interval '1 minute'");
  await as(ids.driver, () =>
    rejects(db.query("select public.update_bus_location($1, 12.97, 77.59, 5)", [ids["BUS-01"]]), /no active trip/),
  );

  // Students no longer see the completed trip; the driver and admin do.
  const s = await as(ids.student, () => db.query("select id from public.trips"));
  assert.equal(s.rows.length, 0);
  const d = await as(ids.driver, () => db.query("select id from public.trips"));
  assert.equal(d.rows.length, 1);
});

test("admins can cancel a driver's active trip", async () => {
  const { rows } = await as(ids.driver2, () => db.query("select id from public.start_trip($1)", [ids["BUS-02"]]));
  const ended = await as(ids.admin, () => db.query("select status from public.end_trip($1)", [rows[0].id]));
  assert.equal(ended.rows[0].status, "cancelled");
});

test("assign_driver moves a driver between buses atomically and is admin-only", async () => {
  await as(ids.driver, () =>
    rejects(db.query("select public.assign_driver($1, $2)", [ids.driver, ids["BUS-03"]]), /only admins/),
  );
  await as(ids.admin, () => db.query("select public.assign_driver($1, $2)", [ids.driver, ids["BUS-03"]]));
  const { rows } = await db.query("select bus_number from public.buses where driver_id = $1", [ids.driver]);
  assert.deepEqual(rows.map((r) => r.bus_number), ["BUS-03"]);
  await as(ids.admin, () => db.query("select public.assign_driver($1, $2)", [ids.driver, ids["BUS-01"]]));
  // Unassign.
  await as(ids.admin, () => db.query("select public.assign_driver($1, null)", [ids.driver]));
  const after = await db.query("select count(*)::int as n from public.buses where driver_id = $1", [ids.driver]);
  assert.equal(after.rows[0].n, 0);
  await as(ids.admin, () => db.query("select public.assign_driver($1, $2)", [ids.driver, ids["BUS-01"]]));
});

test("demoting a driver removes their bus assignment", async () => {
  await as(ids.admin, () => db.query("update public.profiles set role = 'student' where id = $1", [ids.driver2]));
  const { rows } = await db.query("select driver_id from public.buses where id = $1", [ids["BUS-02"]]);
  assert.equal(rows[0].driver_id, null);
});

test("tables are published for Realtime", async () => {
  const { rows } = await db.query(
    "select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename",
  );
  assert.deepEqual(rows.map((r) => r.tablename), ["bus_locations", "trips"]);
});
