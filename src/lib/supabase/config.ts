/**
 * Supabase-Verbindungsdaten — bewusst OHNE `NEXT_PUBLIC_`-Prefix, damit URL und
 * Key NICHT ins Browser-Bundle gelangen.
 *
 * Seit dem SSR-only-Umbau spricht ausschließlich der Next.js-Server mit
 * Supabase (Server Components, Server Actions, Proxy/Session-Refresh), nie der
 * Browser. Dadurch kann das Gateway (Kong) im internen Netz bleiben und muss
 * nicht öffentlich erreichbar sein.
 *
 * Fallback auf die alten `NEXT_PUBLIC_`-Namen, damit bestehende lokale
 * `.env.local`-Dateien ohne Änderung weiterlaufen. Auf Produktiv-/Staging-
 * Instanzen die server-only Namen `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`
 * setzen (reine Runtime-ENV, kein Build-Zeit-Inlining nötig).
 */

export function supabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "http://127.0.0.1:54321"
  );
}

export function supabaseKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  );
}
