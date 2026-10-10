import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/dashboard",
  driver: "/driver",
  student: "/track",
};

export type CurrentUser = {
  id: string;
  email: string | null;
  profile: Profile;
};

/**
 * The signed-in user and their profile, or null. Verifies the JWT with
 * getClaims() rather than trusting the cookie session. Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", claims.sub)
    .maybeSingle();
  if (profileError) throw new Error(`Could not load profile: ${profileError.message}`);

  // A valid token but no profile means the account was deleted while this
  // browser was still signed in. Clear the stale session; otherwise the proxy
  // keeps treating the browser as signed in and bounces /login back to /.
  if (!profile) redirect("/auth/signout");

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    profile,
  };
});

/** Redirects to /login when signed out, or to the user's home when the role is not allowed. */
export async function requireRole(...roles: UserRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.profile.role)) redirect(ROLE_HOME[user.profile.role]);
  return user;
}
