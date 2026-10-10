import { requireRole } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";

export default async function TrackLayout({ children }: LayoutProps<"/track">) {
  const user = await requireRole("student", "driver", "admin");
  return (
    <>
      <Navbar user={user} />
      {children}
    </>
  );
}
