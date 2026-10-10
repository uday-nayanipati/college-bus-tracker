"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/auth";
import type { UserRole } from "@/types/database";

const ROLE_AREAS: Record<UserRole, string[]> = {
  admin: ["/dashboard", "/admin", "/track"],
  driver: ["/driver", "/track"],
  student: ["/track"],
};

export type AuthFormState = { error?: string; email?: string };

/** Only allow same-site relative redirects. */
function safeNext(value: FormDataEntryValue | null): string | null {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.status === 429) {
      return { error: "Too many attempts. Please wait a moment and try again.", email };
    }
    return { error: "Invalid email or password.", email };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "This account has no profile. Ask the administrator to recreate it.", email };
  }
  const next = safeNext(formData.get("next"));
  // Only follow `next` if it is inside an area this role can use.
  const allowed = next && ROLE_AREAS[profile.role].some((a) => next === a || next.startsWith(`${a}/`) || next.startsWith(`${a}?`));
  redirect(allowed ? next : ROLE_HOME[profile.role]);
}

/** Public sign-up creates student accounts only (enforced by the database trigger). */
export async function signUp(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || fullName.length > 120) return { error: "Enter your full name.", email };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address.", email };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", email };

  // Email confirmation is disabled in Supabase, so sign-up returns a session
  // immediately and the new student is signed in straight away.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { error: "An account with this email already exists. Sign in instead.", email };
    }
    if (error.code === "weak_password") return { error: error.message, email };
    if (error.status === 429) return { error: "Too many attempts. Please try again later.", email };
    return { error: "Could not create the account. Please try again.", email };
  }

  if (!data.session) {
    // Only happens if "Confirm email" is switched back on in Supabase.
    return { error: "Account created, but sign-in is pending. Please try signing in.", email };
  }
  redirect("/track");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
