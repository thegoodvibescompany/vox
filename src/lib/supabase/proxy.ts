import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseKey, supabaseUrl } from "./config";
import { buildCsp, generateNonce } from "@/lib/csp";

export async function updateSession(request: NextRequest) {
  // Pro-Request-Nonce für die Content-Security-Policy. Die Nonce wird in die
  // Request-Header geschrieben, damit Next.js sie auf seine Inline-Skripte
  // anwendet; der fertige CSP-Wert landet zusätzlich auf der Response.
  const nonce = generateNonce();
  const csp = buildCsp(nonce);
  const withCspHeaders = () => {
    // Frischer Klon bei jedem Aufruf, damit zwischenzeitliche Cookie-Updates
    // (request.cookies.set unten) in die weitergereichten Header einfließen.
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return headers;
  };

  let supabaseResponse = NextResponse.next({
    request: { headers: withCspHeaders() },
  });

  const supabase = createServerClient(
    supabaseUrl(),
    supabaseKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: { headers: withCspHeaders() },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // WICHTIG: getUser() direkt nach createServerClient aufrufen, sonst
  // werden Sessions nicht zuverlässig refreshed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Nicht eingeloggte Nutzer von geschützten Bereichen wegleiten.
  // Öffentliche Routen: /login, /auth/*, /antworten/*, /_next
  // /email-templates/* muss öffentlich bleiben, weil der selbstgehostete
  // Supabase-Auth die Mail-Vorlagen per HTTP GET von dort lädt (sonst
  // Redirect auf /login → GoTrue fällt auf sein totes Default-Template zurück).
  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/antworten") ||
    path.startsWith("/email-templates") ||
    path.startsWith("/_next");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  supabaseResponse.headers.set("Content-Security-Policy", csp);
  return supabaseResponse;
}
