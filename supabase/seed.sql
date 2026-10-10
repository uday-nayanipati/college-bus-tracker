-- Sample routes and buses for local development / demos.
-- Users (admins, drivers, students) are NOT seeded: create them through
-- Supabase Auth and follow "Provisioning accounts" in README.md.

insert into public.routes (route_name, start_point, end_point) values
  ('Route A - City Centre', 'Central Bus Stand', 'College Main Gate'),
  ('Route B - North Campus', 'Railway Station', 'North Campus Hostel'),
  ('Route C - East Suburbs', 'East Market', 'College Main Gate')
on conflict (route_name) do nothing;

insert into public.buses (bus_number, capacity, status, route_id)
select v.bus_number, v.capacity, v.status::public.bus_status, r.id
from (values
  ('BUS-01', 50, 'active', 'Route A - City Centre'),
  ('BUS-02', 45, 'active', 'Route B - North Campus'),
  ('BUS-03', 40, 'maintenance', 'Route C - East Suburbs')
) as v(bus_number, capacity, status, route_name)
join public.routes r on r.route_name = v.route_name
on conflict (bus_number) do nothing;
