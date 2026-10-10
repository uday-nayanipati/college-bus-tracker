# College Bus Tracker

Real-time college bus tracking. Admins manage buses, routes and driver assignments. A driver starts a trip and shares GPS from their phone's browser. Students watch the bus move on a live map.

**Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Supabase (Auth, Postgres, Realtime), Leaflet with OpenStreetMap, Vercel.

## How it works

1. A driver signs in and taps **Start trip**. The `start_trip` database function checks that the driver is assigned to the bus, the bus is in service, and neither the bus nor the driver already has an active trip.
2. The driver page reads GPS with `navigator.geolocation.watchPosition()`. It validates each reading (range, not 0/0, accuracy ≤ 500 m) and publishes the newest one every 7 seconds through `update_bus_location`. That function checks the caller has the active trip for the bus, validates again, throttles to one write per 2 s, and upserts the bus's single row in `bus_locations` using server time.
3. Supabase Realtime pushes the row change to `/track` and `/track/[busId]`. The map moves its existing marker. It doesn't add a new one.
4. **End trip** calls `end_trip`, which stops the GPS watcher, marks the trip completed and detaches the location row from the trip. Students see the trip end, and the last known position stays on the map.

Locations are shown as **Live** (< 1 min), **Delayed update** (1–5 min) or **Signal lost** (> 5 min).

## Project structure

```
app/
  (admin)/                 admin-only area (layout checks the role)
    dashboard/             fleet overview, active and completed trips
    admin/buses|routes|drivers
    actions.ts             admin server actions (re-check the role; RLS enforces it too)
  driver/                  driver portal (mobile-first)
  track/ and track/[busId] student list and live map
  login/ signup/ auth/     authentication
components/                UI: BusMap, BusTracker, DriverTripControls, BusTable, StatusBadge…
lib/
  supabase/client.ts       browser client
  supabase/server.ts       server client (cookies)
  supabase/proxy.ts        session refresh + signed-out redirect (used by proxy.ts)
  auth.ts                  getCurrentUser / requireRole
  use-gps-publisher.ts     driver GPS watcher and uploader
  use-live-bus.ts          Realtime subscriptions for the student views
supabase/
  migrations/              schema, RLS policies and RPC functions
  seed.sql                 sample routes and buses
  tests/rls.test.mjs       runs the migration in PGlite and tests the policies
types/database.ts          TypeScript types for the schema
proxy.ts                   Next.js proxy (formerly "middleware")
```

## Local setup

Prerequisites: Node.js 20+ and a free [Supabase](https://supabase.com) project.

```bash
npm install
cp .env.example .env.local    # then fill in the values below
npm run dev                   # http://localhost:3000
```

`.env.local`:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → publishable key (`sb_publishable_…`). The legacy `anon` key also works through `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `NEXT_PUBLIC_MAP_TILE_URL` (optional) | Tile server URL. Defaults to the public OpenStreetMap server. |

> **Never** put the `service_role`/secret key in this app. Every value here is public and ships to the browser. All security comes from Row Level Security and the database functions.

`NEXT_PUBLIC_*` values are inlined at **build** time. Rebuild after you change them. Until they're set, the app shows a "Supabase is not configured" page.

### Database

Run the migration, then optionally the seed data. Use one of these two methods:

- **SQL editor:** paste `supabase/migrations/20261009000000_initial_schema.sql` into Supabase → SQL Editor and run it. Then run `supabase/seed.sql` if you want sample data.
- **Supabase CLI:** `npx supabase link --project-ref <ref>` then `npx supabase db push`.

The migration creates the tables, RLS policies and RPC functions, and adds `bus_locations` and `trips` to the `supabase_realtime` publication. Realtime still applies RLS: each user only receives rows they're allowed to read.

### Auth settings

In Supabase → Authentication → URL Configuration:

- **Site URL:** `http://localhost:3000` for development, or your production URL.
- **Redirect URLs:** add `http://localhost:3000/**` and `https://<your-domain>/**`.

**Turn off email confirmation:** Authentication → Sign In / Providers → Email → switch off **Confirm email**. The app expects sign-up to sign the user in immediately; no confirmation emails are sent. Accounts created while confirmation was on can be confirmed with:

```sql
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;
```

### Provisioning accounts

There is **no public admin or driver sign-up**. Everyone who signs up at `/signup` becomes a **student**, because the database trigger ignores any role sent from the client.

1. **First admin.** Create the user, either through `/signup` or Supabase → Authentication → Users → Add user. Then run this in the SQL editor, which is a trusted context:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'admin@yourcollege.edu');
   ```
   Admins can't grant or revoke the admin role from the app. Only the SQL editor or the service role can.
2. **Drivers.** The driver signs up at `/signup`. An admin opens **Drivers**, searches for them, taps **Make driver**, then picks their bus.
3. **Students.** They sign up at `/signup`.

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # route type generation + tsc
npm run test:db    # migration + RLS tests (PGlite, no Docker or Supabase needed)
```

`npm run test:db` runs the real migration and seed in an in-process Postgres. It uses a small stand-in for Supabase's `auth` schema and roles, then checks the policies and functions as different users: anon access, self-promotion, admin-only writes, driver assignment, trip conflicts, coordinate validation, throttling, and the Realtime publication. It **doesn't** test Supabase itself. Run the manual checks below against your real project too.

## Testing checklist

Use three browsers or profiles: admin, driver (on a phone) and student (on a second phone).

**Admin**
- [ ] Create a route, then create a bus on that route.
- [ ] Promote the driver account and assign it to the bus.
- [ ] Sign in as a student and confirm `/dashboard` and `/admin/*` redirect away.
- [ ] Call the API directly as a student to confirm RLS rejects the request, not just the UI. Copy the student's access token from the `sb-…-auth-token` cookie, or use Supabase → Authentication → Users → "Impersonate" in the SQL editor:
  ```bash
  curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/buses" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" -H "Authorization: Bearer <student access token>" \
    -H "Content-Type: application/json" -d '{"bus_number":"HACK","capacity":10}'
  # expect: new row violates row-level security policy
  ```

**Driver** (phone, HTTPS; see below)
- [ ] Only the assigned bus is shown.
- [ ] **Start trip** creates an active trip and the dashboard shows it.
- [ ] After allowing location, the status reads "Sharing location", with accuracy and last upload shown.
- [ ] Denying location shows "Location permission denied".
- [ ] Airplane mode for 30 s shows "Offline, will retry", then recovers.
- [ ] **End trip** asks for confirmation, then GPS sharing stops.

**Student**
- [ ] The bus list shows the bus as "On trip" with a live badge.
- [ ] `/track/[busId]` shows the marker, and it moves as the driver moves.
- [ ] Stop the driver's updates (close the tab). After 1 min "Delayed update" appears, and after 5 min "Signal lost".
- [ ] When the driver ends the trip, the status changes to "Not running".

**Responsive:** check 320, 375, 390 and 768 px and desktop in DevTools device mode. There should be no horizontal scrolling. Driver buttons must be reachable. The map and bottom sheet must be usable. Admin tables turn into cards below 768 px.

### Testing GPS on a phone during development

Browsers only allow geolocation on HTTPS, or `localhost`. A phone opening `http://192.168.x.x:3000` won't get GPS. Use one of these instead:

- Deploy a preview to Vercel, which is the simplest option.
- Tunnel the dev server, for example `npx cloudflared tunnel --url http://localhost:3000` or ngrok, and add the tunnel URL to Supabase's redirect URLs.

## Deployment (Vercel)

1. Push the repository to GitHub and import it in Vercel. If the app sits in a subfolder of the repo, set **Root Directory** to `college-bus-tracker`.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` under Project → Settings → Environment Variables, for Production and Preview. Don't add the secret key.
3. Deploy.
4. In Supabase → Authentication → URL Configuration, set the Site URL to the production domain and add `https://<domain>/**` to the redirect URLs.
5. Make sure the migration has been applied to the production database and an admin has been provisioned.
6. Do a production end-to-end check: an admin creates a bus and assigns a driver, the driver starts a trip on a phone, and a student on another phone sees the marker move.

## Known limitations

- **Background tracking.** Browsers pause GPS when the phone is locked or the browser is in the background. The driver page asks for a screen wake lock where supported and warns the driver, but continuous background tracking needs a native app.
- **Map tiles.** The public OpenStreetMap tile server is for light use only ([tile usage policy](https://operations.osmfoundation.org/policies/tiles/)). For real traffic, set `NEXT_PUBLIC_MAP_TILE_URL` to a commercial or self-hosted tile provider and update `NEXT_PUBLIC_MAP_ATTRIBUTION`.
- **Location history.** Only the latest location per bus is stored.
- **Not in version 1:** ETAs, route stops and optimisation, push notifications.
