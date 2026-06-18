import Link from "next/link";
import { requireRecht } from "@/lib/auth";
import { getAktiveLage } from "@/lib/lage";
import { createClient } from "@/lib/supabase/server";
import { LageCard } from "../lage-card";
import type { LageVorlage } from "@/lib/types";

export default async function EinstellungenLagePage() {
  await requireRecht("lage.verwalten");
  const supabase = await createClient();
  const lage = await getAktiveLage();
  const { data: vorlagenRaw } = await supabase
    .from("lage_vorlage")
    .select("*")
    .order("name", { ascending: true });
  const vorlagen = (vorlagenRaw ?? []) as LageVorlage[];

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <div>
        <Link
          href="/einstellungen"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Einstellungen
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Lage</h1>
      </div>

      <LageCard aktiveLage={lage} vorlagen={vorlagen} />
    </main>
  );
}
