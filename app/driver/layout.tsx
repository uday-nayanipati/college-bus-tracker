import { requireRole } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";

export default async function DriverLayout({ children }: LayoutProps<"/driver">) {
  const user = await requireRole("driver");
  return (
    <>
      <Navbar user={user} />
      {children}
    </>
  );
}
