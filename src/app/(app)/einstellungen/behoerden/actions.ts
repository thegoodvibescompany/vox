"use server";

import { revalidatePath } from "next/cache";
import { requirePlattformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type BehoerdenActionState = { ok: boolean; message: string };

export async function setzeBehoerdeStatus(
  id: string,
  status: "aktiv" | "gesperrt",
): Promise<BehoerdenActionState> {
  await requirePlattformAdmin();
  if (status !== "aktiv" && status !== "gesperrt")
    return { ok: false, message: "Ungültiger Status." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("behoerde")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/einstellungen/behoerden");
  return {
    ok: true,
    message: status === "gesperrt" ? "Behörde gesperrt." : "Sperre aufgehoben.",
  };
}
