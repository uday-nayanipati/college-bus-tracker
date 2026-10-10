import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New student?{" "}
          <Link href="/signup" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
      <p className="mt-4 text-xs text-slate-500">
        Driver and admin accounts are created by the college transport office.
      </p>
    </AuthShell>
  );
}
