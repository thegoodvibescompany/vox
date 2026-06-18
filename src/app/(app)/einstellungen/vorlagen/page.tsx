import Link from "next/link";
import { requireRecht } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NeueVorlageButton } from "./neue-vorlage-button";
import type { LageVorlage } from "@/lib/types";

export default async function EinstellungenVorlagenPage() {
  await requireRecht("vorlage.verwalten");
  const supabase = await createClient();
  const { data } = await supabase
    .from("lage_vorlage")
    .select("*")
    .order("name", { ascending: true });
  const vorlagen = (data ?? []) as LageVorlage[];

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <div>
        <Link
          href="/einstellungen"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Einstellungen
        </Link>
        <div className="flex items-start justify-between gap-3 mt-1">
          <h1 className="text-2xl font-semibold">Vorlagen</h1>
          <NeueVorlageButton />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Standard-Kategorien und Standard-FAQs pro Szenario. Beim Lage-Start
          wird die gewählte Vorlage geladen.
        </p>
      </div>

      <ul className="space-y-3">
        {vorlagen.map((v) => (
          <li key={v.id}>
            <Link
              href={`/einstellungen/vorlagen/${v.id}`}
              className="block rounded-lg border bg-white p-4 hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="font-medium">{v.name}</div>
                <div className="text-xs text-muted-foreground">
                  {v.kategorien.length} Kategorien · {v.standard_faqs.length} FAQs
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {v.kategorien.map((k) => (
                  <span
                    key={k.name}
                    className="text-xs rounded-full bg-stone-100 text-stone-700 px-2 py-0.5"
                  >
                    {k.name}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
        {vorlagen.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Noch keine Vorlagen angelegt.
          </p>
        )}
      </ul>
    </main>
  );
}
