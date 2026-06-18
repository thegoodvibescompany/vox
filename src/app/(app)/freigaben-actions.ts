"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireRecht } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markiereAnfrageGesehen(
  bfId: string,
): Promise<{ ok: boolean }> {
  await requireRecht("anfrage.freigeben");
  const supabase = await createClient();
  const { error } = await supabase.rpc("markiere_anfrage_gesehen", {
    p_buergerfrage_id: bfId,
  });
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markiereFaqGelesen(
  faqId: string,
): Promise<{ ok: boolean }> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("markiere_faq_gelesen", {
    p_faq_id: faqId,
  });
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}

// Telemetrie für das "Häufig gestellte Fragen"-Ranking auf der Startseite.
// Bewusst kein revalidatePath — Top-3-Aktualisierung darf etwas verzögert
// erfolgen, sonst löst jedes Detail-Öffnen ein Full-Re-Render aus.
export async function inkrementiereFaqKlick(
  faqId: string,
): Promise<{ ok: boolean }> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("inkrementiere_faq_klick", {
    p_faq_id: faqId,
  });
  if (error) return { ok: false };
  return { ok: true };
}
