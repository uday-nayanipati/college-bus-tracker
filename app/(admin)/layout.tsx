import { requireRole } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");
  return (
    <>
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
        {children}
      </main>
    </>
  );
}
