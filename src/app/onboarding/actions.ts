"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type WizardState = {
  ok: boolean;
  message: string;
};

/**
 * Onboarding-Wizard: legt eine neue Behörde an und macht den Aufrufer zur
 * Administrator:in. Die eigentliche Logik + Berechtigungsprüfung steckt in der
 * SECURITY-DEFINER-RPC gruende_behoerde(); diese Action validiert nur die
 * Eingabe und reicht durch.
 */
export async function richteBehoerdeEin(
  _prev: WizardState | undefined,
  formData: FormData,
): Promise<WizardState> {
  await requireProfile(); // eingeloggt + aktiv (sonst redirect)

  const name = ((formData.get("name") as string | null) ?? "").trim();
  const typ = ((formData.get("typ") as string | null) ?? "").trim();

  if (!name) {
    return { ok: false, message: "Bitte den Namen der Behörde angeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("gruende_behoerde", {
    p_name: name,
    p_typ: typ.length > 0 ? typ : undefined,
  });

  if (error) {
    return {
      ok: false,
      message: error.message || "Die Behörde konnte nicht angelegt werden.",
    };
  }

  redirect("/");
}
