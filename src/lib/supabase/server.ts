import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./config";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl(),
    supabaseKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll wird in Server Components aufgerufen, wo Cookies nur
            // in Middleware oder Route Handlern gesetzt werden können.
            // Wenn Middleware Sessions auffrischt, kann das ignoriert werden.
          }
        },
      },
    },
  );
}
