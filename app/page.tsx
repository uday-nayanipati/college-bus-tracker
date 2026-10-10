import { redirect } from "next/navigation";
import { Bus, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth";
import { LinkButton } from "@/components/ui";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.profile.role]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2 font-bold text-slate-900">
        <span className="grid size-9 place-items-center rounded-lg bg-brand-600 text-white">
          <Bus aria-hidden className="size-5" />
        </span>
        College Bus Tracker
      </div>

      <section className="flex flex-1 flex-col justify-center py-10">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Know where your college bus is, right now.
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
          Drivers share their location during a trip. Students see the bus move on a live map, with
          the time of the last update.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <LinkButton href="/login" size="lg">
            Sign in
          </LinkButton>
          <LinkButton href="/signup" size="lg" variant="secondary">
            Create a student account
          </LinkButton>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { Icon: MapPin, title: "Live map", text: "See the bus marker update as the driver moves." },
            { Icon: Navigation, title: "Driver GPS", text: "Drivers start a trip and share location from their phone." },
            { Icon: ShieldCheck, title: "Secure roles", text: "Admins manage the fleet; access is enforced by the database." },
          ].map(({ Icon, title, text }) => (
            <li key={title} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <Icon aria-hidden className="size-5 text-brand-600" />
              <p className="mt-2 font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
