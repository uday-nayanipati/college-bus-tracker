import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create student account" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create a student account"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
