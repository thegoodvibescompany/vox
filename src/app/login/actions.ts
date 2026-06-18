"use server";

import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/env";

export type LoginState = {
  ok: boolean;
  message: string;
  /** Bei Erfolg die Adresse, an die der Link ging — für die Bestätigung. */
  email?: string;
};

export async function signInWithMagicLink(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, message: "Bitte eine gültige E-Mail-Adresse angeben." };
  }

  const supabase = await createClient();

  // Freemail-Sperre: private E-Mail-Anbieter sind keine Behörden-Domains und
  // dürfen sich nicht anmelden. Die Blockliste liegt in der DB (ist_freemail,
  // für anon ausführbar). Fail-open bei DB-Fehler: die eigentliche Absicherung
  // gegen eine Freemail-Gründung liegt serverseitig in gruende_behoerde.
  const emailDomain = email.split("@")[1] ?? "";
  const { data: istFreemail } = await supabase.rpc("ist_freemail", {
    p_domain: emailDomain,
  });
  if (istFreemail === true) {
    return {
      ok: false,
      message:
        "Private E-Mail-Anbieter (z. B. gmx, web.de, gmail) sind nicht zugelassen. Bitte melde dich mit deiner dienstlichen Adresse an.",
    };
  }

  const origin = await getRequestOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/")}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return {
      ok: false,
      message: `Login fehlgeschlagen: ${error.message}`,
    };
  }

  return {
    ok: true,
    message: "Magic Link wurde an deine E-Mail-Adresse geschickt. Prüfe dein Postfach.",
    email,
  };
}
