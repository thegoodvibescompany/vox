"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bereinigeNotizInhalt } from "@/lib/notiz-bereinige";

export type NotizActionState = {
  ok: boolean;
  message: string;
};

export async function erstelleNotiz(formData: FormData): Promise<NotizActionState> {
  const profile = await requireProfile();
  const inhalt = bereinigeNotizInhalt(formData.get("inhalt") as string | null);
  if (!inhalt) {
    return { ok: false, message: "Notiz darf nicht leer sein." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("notiz").insert({
    user_id: profile.id,
    inhalt,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  return { ok: true, message: "Notiz gespeichert." };
}

export async function aktualisiereNotiz(formData: FormData): Promise<NotizActionState> {
  const profile = await requireProfile();
  const id = formData.get("id") as string | null;
  const inhalt = bereinigeNotizInhalt(formData.get("inhalt") as string | null);
  if (!id) return { ok: false, message: "Keine Notiz angegeben." };
  if (!inhalt) return { ok: false, message: "Notiz darf nicht leer sein." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("notiz")
    .update({ inhalt })
    .eq("id", id)
    .eq("user_id", profile.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  return { ok: true, message: "Notiz aktualisiert." };
}

export async function loescheNotiz(formData: FormData): Promise<NotizActionState> {
  const profile = await requireProfile();
  const id = formData.get("id") as string | null;
  if (!id) return { ok: false, message: "Keine Notiz angegeben." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("notiz")
    .delete()
    .eq("id", id)
    .eq("user_id", profile.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  return { ok: true, message: "Notiz gelöscht." };
}
