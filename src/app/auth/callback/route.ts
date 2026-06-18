import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/env";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  // Open-Redirect-Schutz: next muss ein interner Pfad sein.
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  const origin = await getRequestOrigin();
  const supabase = await createClient();

  // Neuer Flow (SSR-only): Der Magic-Link zeigt direkt auf die App und enthält
  // token_hash + type. Der Server löst ihn server-zu-server gegen Supabase ein,
  // daher muss das Auth-Gateway (Kong) nicht öffentlich erreichbar sein.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (code) {
    // Fallback: klassischer PKCE-Code-Flow (alte Links / OAuth-Provider).
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Anmelde-Link ungültig oder abgelaufen.")}`,
  );
}
