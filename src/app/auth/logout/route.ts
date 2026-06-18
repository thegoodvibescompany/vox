import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/env";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Hinter einem Reverse-Proxy ist request.url die interne URL (z. B.
  // localhost:3000); getRequestOrigin() liest x-forwarded-host und leitet auf
  // die oeffentliche Origin zurueck — analog zu callback/route.ts.
  const origin = await getRequestOrigin();
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
