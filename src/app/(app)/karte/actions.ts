"use server";

import { revalidatePath } from "next/cache";
import { requireRecht } from "@/lib/auth";
import { getAktiveLage } from "@/lib/lage";
import { createClient } from "@/lib/supabase/server";
import type { KartenFarbe, KartenTyp } from "@/lib/types";
import { istKartenFarbe } from "@/lib/karten-farbe";
import { logger } from "@/lib/logger";
import type { Geometry } from "geojson";

export type KartenActionState = {
  ok: boolean;
  message: string;
  id?: string;
};

function pruefeFarbe(value: unknown): KartenFarbe | string {
  if (!istKartenFarbe(value)) return "Ungültige Farbe.";
  return value;
}

export async function speichereKartenobjekt(input: {
  typ: KartenTyp;
  geometry: Geometry;
  radius_m?: number | null;
  titel: string;
  beschreibung?: string;
  farbe: KartenFarbe;
}): Promise<KartenActionState> {
  const profile = await requireRecht("karte.zeichnen");
  const lage = await getAktiveLage();
  if (!lage) return { ok: false, message: "Keine aktive Lage." };

  const titel = input.titel.trim();
  if (!titel) return { ok: false, message: "Bitte einen Titel angeben." };

  if (input.typ === "kreis" && (!input.radius_m || input.radius_m <= 0)) {
    return { ok: false, message: "Kreis braucht einen Radius größer 0." };
  }

  const farbe = pruefeFarbe(input.farbe);
  if (typeof farbe === "string" && !istKartenFarbe(farbe)) {
    return { ok: false, message: farbe };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kartenobjekt")
    .insert({
      lage_id: lage.id,
      typ: input.typ,
      geometry: input.geometry as unknown as Record<string, unknown>,
      radius_m: input.typ === "kreis" ? input.radius_m : null,
      titel,
      beschreibung: input.beschreibung?.trim() || null,
      farbe: input.farbe,
      autor_id: profile.id,
    })
    .select("id")
    .single();
  if (error) {
    logger.error("speichereKartenobjekt failed:", error);
    return { ok: false, message: error.message };
  }
  revalidatePath("/karte");
  return { ok: true, message: "Kartenobjekt gespeichert.", id: data?.id };
}

export async function aktualisiereKartenobjekt(input: {
  id: string;
  titel: string;
  beschreibung?: string;
  farbe: KartenFarbe;
}): Promise<KartenActionState> {
  await requireRecht("karte.bearbeiten");

  const titel = input.titel.trim();
  if (!titel) return { ok: false, message: "Bitte einen Titel angeben." };

  const farbe = pruefeFarbe(input.farbe);
  if (typeof farbe === "string" && !istKartenFarbe(farbe)) {
    return { ok: false, message: farbe };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("kartenobjekt")
    .update({
      titel,
      beschreibung: input.beschreibung?.trim() || null,
      farbe: input.farbe,
    })
    .eq("id", input.id);
  if (error) {
    logger.error("aktualisiereKartenobjekt failed:", error);
    return { ok: false, message: error.message };
  }
  revalidatePath("/karte");
  return { ok: true, message: "Kartenobjekt aktualisiert." };
}

export async function loescheKartenobjekt(
  id: string,
): Promise<KartenActionState> {
  await requireRecht("karte.bearbeiten");
  const supabase = await createClient();
  const { error } = await supabase.from("kartenobjekt").delete().eq("id", id);
  if (error) {
    logger.error("loescheKartenobjekt failed:", error);
    return { ok: false, message: error.message };
  }
  revalidatePath("/karte");
  return { ok: true, message: "Kartenobjekt gelöscht." };
}
