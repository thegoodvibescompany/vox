import Link from "next/link";
import { requirePlattformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BehoerdenUebersicht } from "./behoerden-uebersicht";
import type { PlattformBehoerde } from "@/lib/types";

export default async function BehoerdenUebersichtPage() {
  await requirePlattformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plattform_behoerden");
  const behoerden = (data ?? []) as PlattformBehoerde[];

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div>
        <Link
          href="/einstellungen"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Einstellungen
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Behördenübersicht</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alle Behörden der Plattform. Bei Bedarf sperren.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700">
          Die Übersicht konnte nicht geladen werden: {error.message}
        </p>
      ) : (
        <BehoerdenUebersicht behoerden={behoerden} />
      )}
    </main>
  );
}
