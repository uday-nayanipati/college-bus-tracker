-- College Bus Tracking System: initial schema, RLS policies and trip/location RPCs.
--
-- Security model
--   * Every table has RLS enabled. The anon role gets nothing.
--   * New sign-ups always get role 'student' (metadata is ignored).
--   * Nobody can promote themselves. Admins may switch users between
--     'student' and 'driver'; granting/revoking 'admin' is only possible from a
--     trusted context (SQL editor / service role), where auth.uid() is null.
--   * Trips are started/ended and locations written only through the
--     SECURITY DEFINER functions below, which check the caller's assignment.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'driver', 'student');
create type public.bus_status as enum ('active', 'maintenance', 'inactive');
create type public.trip_status as enum ('active', 'completed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  -- Copied from auth.users at sign-up so admins can identify people.
  email text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  route_name text not null unique check (char_length(trim(route_name)) between 1 and 120),
  start_point text not null check (char_length(trim(start_point)) between 1 and 200),
  end_point text not null check (char_length(trim(end_point)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.buses (
  id uuid primary key default gen_random_uuid(),
  bus_number text not null unique check (char_length(trim(bus_number)) between 1 and 40),
  capacity integer not null check (capacity between 1 and 200),
  status public.bus_status not null default 'active',
  -- Assigned driver and default route. A driver is assigned to at most one bus.
  driver_id uuid unique references public.profiles (id) on delete set null,
  route_id uuid references public.routes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buses_route_id_idx on public.buses (route_id);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  bus_id uuid not null references public.buses (id) on delete restrict,
  driver_id uuid not null references public.profiles (id) on delete restrict,
  route_id uuid references public.routes (id) on delete set null,
  status public.trip_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint trips_ended_at_matches_status
    check ((status = 'active') = (ended_at is null)),
  constraint trips_ended_after_started
    check (ended_at is null or ended_at >= started_at)
);

-- At most one active trip per bus and per driver.
create unique index trips_one_active_per_bus on public.trips (bus_id) where status = 'active';
create unique index trips_one_active_per_driver on public.trips (driver_id) where status = 'active';
create index trips_bus_started_idx on public.trips (bus_id, started_at desc);
create index trips_driver_started_idx on public.trips (driver_id, started_at desc);
create index trips_status_started_idx on public.trips (status, started_at desc);

-- Latest known location per bus (no history).
create table public.bus_locations (
  bus_id uuid primary key references public.buses (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision check (accuracy is null or accuracy >= 0),
  updated_at timestamptz not null default now()
);

create index bus_locations_trip_id_idx on public.bus_locations (trip_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so policies can read profiles without
-- recursing into profiles' own RLS)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger routes_set_updated_at before update on public.routes
  for each row execute function public.set_updated_at();
create trigger buses_set_updated_at before update on public.buses
  for each row execute function public.set_updated_at();

-- Create a profile for every new auth user. The role is always 'student',
-- whatever the client put into user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    new.email,
    'student'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guard role changes on profiles.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profile id cannot change';
  end if;

  if new.role is distinct from old.role then
    -- Trusted contexts (SQL editor, service role) have no auth.uid().
    if auth.uid() is not null then
      if not public.is_admin() then
        raise exception 'only admins can change roles' using errcode = '42501';
      end if;
      if new.role = 'admin' or old.role = 'admin' then
        raise exception 'admin role can only be granted or revoked by a trusted process'
          using errcode = '42501';
      end if;
    end if;

    -- A user who is no longer a driver loses their bus assignment.
    if old.role = 'driver' and new.role <> 'driver' then
      if exists (
        select 1 from public.trips t where t.driver_id = new.id and t.status = 'active'
      ) then
        raise exception 'driver has an active trip; end it before changing the role';
      end if;
      update public.buses set driver_id = null where driver_id = new.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Only users with the driver role may be assigned to a bus.
create or replace function public.guard_bus_driver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.driver_id is not null
     and (tg_op = 'INSERT' or new.driver_id is distinct from old.driver_id) then
    if not exists (
      select 1 from public.profiles p where p.id = new.driver_id and p.role = 'driver'
    ) then
      raise exception 'assigned user must have the driver role';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.driver_id is distinct from old.driver_id
     and exists (
       select 1 from public.trips t where t.bus_id = new.id and t.status = 'active'
     ) then
    raise exception 'cannot change the driver while the bus has an active trip';
  end if;

  return new;
end;
$$;

create trigger buses_guard_driver
  before insert or update on public.buses
  for each row execute function public.guard_bus_driver();

-- ---------------------------------------------------------------------------
-- Trip lifecycle and location RPCs
-- ---------------------------------------------------------------------------

-- Start a trip on the caller's assigned bus.
create or replace function public.start_trip(p_bus_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_bus public.buses;
  v_trip public.trips;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.current_user_role() is distinct from 'driver' then
    raise exception 'only drivers can start trips' using errcode = '42501';
  end if;

  -- Lock the bus row so concurrent starts serialize.
  select * into v_bus from public.buses where id = p_bus_id for update;
  if not found or v_bus.driver_id is distinct from v_uid then
    raise exception 'you are not assigned to this bus' using errcode = '42501';
  end if;
  if v_bus.status <> 'active' then
    raise exception 'bus is not in service (status: %)', v_bus.status;
  end if;
  if exists (select 1 from public.trips where bus_id = p_bus_id and status = 'active') then
    raise exception 'this bus already has an active trip';
  end if;
  if exists (select 1 from public.trips where driver_id = v_uid and status = 'active') then
    raise exception 'you already have an active trip';
  end if;

  insert into public.trips (bus_id, driver_id, route_id, status)
  values (p_bus_id, v_uid, v_bus.route_id, 'active')
  returning * into v_trip;

  return v_trip;
end;
$$;

-- End an active trip. Drivers can end their own; admins can end any.
create or replace function public.end_trip(p_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_trip public.trips;
  v_admin boolean := public.is_admin();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found or (v_trip.driver_id is distinct from v_uid and not v_admin) then
    raise exception 'trip not found' using errcode = '42501';
  end if;
  if v_trip.status <> 'active' then
    raise exception 'trip is not active';
  end if;

  update public.trips
     set status = case when v_trip.driver_id = v_uid then 'completed'::public.trip_status
                       else 'cancelled'::public.trip_status end,
         ended_at = now()
   where id = p_trip_id
  returning * into v_trip;

  -- Students cannot see ended trips (RLS), so they would never receive the
  -- trip UPDATE over Realtime. Clearing trip_id on the location row gives them
  -- a visible "trip ended" signal; the last known position is kept.
  update public.bus_locations set trip_id = null
   where bus_id = v_trip.bus_id and trip_id = v_trip.id;

  return v_trip;
end;
$$;

-- Publish the latest location for the caller's bus. Requires an active trip
-- on that bus driven by the caller. Server time is used for updated_at.
-- Returns false when the write was skipped because of server-side throttling.
create or replace function public.update_bus_location(
  p_bus_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_trip_id uuid;
  v_last timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude = 'NaN'::double precision or p_longitude = 'NaN'::double precision
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180
     or (p_latitude = 0 and p_longitude = 0) then
    raise exception 'invalid coordinates' using errcode = '22023';
  end if;
  if p_accuracy is not null and (p_accuracy = 'NaN'::double precision or p_accuracy < 0) then
    raise exception 'invalid accuracy' using errcode = '22023';
  end if;

  select t.id into v_trip_id
    from public.trips t
   where t.bus_id = p_bus_id and t.driver_id = v_uid and t.status = 'active';
  if v_trip_id is null then
    raise exception 'no active trip for this bus' using errcode = '42501';
  end if;

  -- Server-side throttle: ignore writes less than 2 seconds apart.
  select updated_at into v_last from public.bus_locations where bus_id = p_bus_id;
  if v_last is not null and v_last > now() - interval '2 seconds' then
    return false;
  end if;

  insert into public.bus_locations (bus_id, trip_id, latitude, longitude, accuracy, updated_at)
  values (p_bus_id, v_trip_id, p_latitude, p_longitude, p_accuracy, now())
  on conflict (bus_id) do update
    set trip_id = excluded.trip_id,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy = excluded.accuracy,
        updated_at = excluded.updated_at;

  return true;
end;
$$;

-- Admin: assign a driver to a bus (or unassign with p_bus_id = null),
-- atomically moving them off any previous bus.
create or replace function public.assign_driver(p_driver_id uuid, p_bus_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can assign drivers' using errcode = '42501';
  end if;

  update public.buses set driver_id = null
   where driver_id = p_driver_id and (p_bus_id is null or id <> p_bus_id);

  if p_bus_id is not null then
    update public.buses set driver_id = p_driver_id where id = p_bus_id;
    if not found then
      raise exception 'bus not found';
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.routes enable row level security;
alter table public.buses enable row level security;
alter table public.trips enable row level security;
alter table public.bus_locations enable row level security;

-- profiles: users see themselves; admins see everyone.
create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles: update own or admin"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
-- No insert/delete policies: profiles are created by trigger and removed with
-- the auth user.

-- routes: every signed-in user can read; admins write.
create policy "routes: read" on public.routes for select to authenticated using (true);
create policy "routes: admin insert" on public.routes for insert to authenticated
  with check ((select public.is_admin()));
create policy "routes: admin update" on public.routes for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "routes: admin delete" on public.routes for delete to authenticated
  using ((select public.is_admin()));

-- buses: students see buses that are not retired; drivers also see their own;
-- admins see all and write.
create policy "buses: read" on public.buses for select to authenticated
  using (
    status <> 'inactive'
    or driver_id = (select auth.uid())
    or (select public.is_admin())
  );
create policy "buses: admin insert" on public.buses for insert to authenticated
  with check ((select public.is_admin()));
create policy "buses: admin update" on public.buses for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "buses: admin delete" on public.buses for delete to authenticated
  using ((select public.is_admin()));

-- trips: everyone sees active trips (for tracking status); drivers see their
-- own history; admins see all. Writes only through start_trip/end_trip.
create policy "trips: read" on public.trips for select to authenticated
  using (
    status = 'active'
    or driver_id = (select auth.uid())
    or (select public.is_admin())
  );

-- bus_locations: readable by signed-in users for buses they can see.
-- Writes only through update_bus_location.
create policy "bus_locations: read" on public.bus_locations for select to authenticated
  using (
    exists (
      select 1 from public.buses b
       where b.id = bus_locations.bus_id
         and (b.status <> 'inactive' or b.driver_id = (select auth.uid()) or (select public.is_admin()))
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.routes, public.buses, public.trips, public.bus_locations from anon;
revoke all on public.profiles, public.routes, public.buses, public.trips, public.bus_locations from authenticated;

grant select on public.profiles, public.routes, public.buses, public.trips, public.bus_locations to authenticated;
grant update (full_name, role) on public.profiles to authenticated;
grant insert, update, delete on public.routes, public.buses to authenticated;

revoke execute on function
  public.current_user_role(),
  public.is_admin(),
  public.start_trip(uuid),
  public.end_trip(uuid),
  public.update_bus_location(uuid, double precision, double precision, double precision),
  public.assign_driver(uuid, uuid),
  public.handle_new_user(),
  public.guard_profile_role(),
  public.guard_bus_driver(),
  public.set_updated_at()
from public, anon;

grant execute on function
  public.current_user_role(),
  public.is_admin(),
  public.start_trip(uuid),
  public.end_trip(uuid),
  public.update_bus_location(uuid, double precision, double precision, double precision),
  public.assign_driver(uuid, uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: broadcast location and trip changes (RLS still applies)
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.bus_locations, public.trips;
