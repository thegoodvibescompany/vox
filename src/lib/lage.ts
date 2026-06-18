import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Lage } from "@/lib/types";

// Pro Request dedupliziert (React cache): Layout, Seite und ggf. Server-Action
// fragen die aktive Lage im selben Render-Durchlauf nur einmal aus der DB ab.
export const getAktiveLage = cache(async (): Promise<Lage | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lage")
    .select("*")
    .eq("aktiv", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as Lage;
});
