"use server";

import { createClient } from "@/lib/supabase/server";

export type AntwortState = {
  ok: boolean;
  message: string;
};

export async function submitAntwort(
  _prev: AntwortState | undefined,
  formData: FormData,
): Promise<AntwortState> {
  const token = (formData.get("token") as string | null)?.trim();
  const antwort = (formData.get("antwort") as string | null)?.trim();
  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();

  if (!token) return { ok: false, message: "Token fehlt." };
  if (!antwort || antwort.length < 5)
    return { ok: false, message: "Bitte eine ausführlichere Antwort eingeben." };
  if (!name || name.length < 2)
    return { ok: false, message: "Bitte Ihren Namen angeben." };
  if (!email || !email.includes("@"))
    return { ok: false, message: "Bitte eine gültige E-Mail-Adresse angeben." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_fachstellen_antwort", {
    p_token: token,
    p_antwort: antwort,
    p_email: email,
    p_name: name,
  });

  if (error) return { ok: false, message: error.message };
  // Bewusst KEIN revalidatePath: Es würde die Server-Seite neu rendern, die
  // dann „bereits beantwortet" zeigt und den Dank-Screen verdrängt. Die Seite
  // ist dynamisch und lädt bei jedem echten Aufruf ohnehin frisch.
  return { ok: true, message: "Antwort gespeichert. Vielen Dank." };
}
