import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Clears a stale session (e.g. the user was deleted) and returns to /login.
// The "local" scope only removes this browser's cookies, so it works even when
// the user no longer exists on the auth server.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  const target = request.nextUrl.clone();
  target.pathname = "/login";
  target.search = "";
  return NextResponse.redirect(target);
}
