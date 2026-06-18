import { redirect } from "next/navigation";
import { hatRecht, requireProfile } from "@/lib/auth";
import { getAktiveLage } from "@/lib/lage";
import { createClient } from "@/lib/supabase/server";
import { KarteWrapper } from "./karte-wrapper";
import type { Kartenobjekt } from "@/lib/types";

export default async function KartePage() {
  const profile = await requireProfile();
  const lage = await getAktiveLage();
  // Ohne aktive Lage: zurück zur Übersicht (einzige "keine Lage"-Stelle).
  if (!lage) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("kartenobjekt")
    .select("*")
    .eq("lage_id", lage.id)
    .order("created_at", { ascending: true });

  const objekte = (data ?? []) as Kartenobjekt[];

  // Ohne gesetzten Lage-Fokus auf die Mitte Deutschlands zoomen
  // (Landesansicht); mit Fokus auf die hinterlegten Koordinaten.
  const DEUTSCHLAND_ZENTRUM: [number, number] = [51.1638, 10.4478];
  const hatFokus =
    lage.map_center_lat !== null && lage.map_center_lon !== null;
  const center: [number, number] = hatFokus
    ? [lage.map_center_lat as number, lage.map_center_lon as number]
    : DEUTSCHLAND_ZENTRUM;
  const zoom = lage.map_default_zoom ?? (hatFokus ? 11 : 6);

  return (
    <KarteWrapper
      objekte={objekte}
      darfBearbeiten={hatRecht(profile, "karte.bearbeiten")}
      center={center}
      zoom={zoom}
    />
  );
}
