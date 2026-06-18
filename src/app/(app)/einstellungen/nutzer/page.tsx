import Link from "next/link";
import { requireRecht } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NutzerVerwaltung } from "./nutzer-verwaltung";
import type { Profile } from "@/lib/types";

export default async function EinstellungenNutzerPage() {
  const profile = await requireRecht(
    "nutzer.rollen_verwalten",
    "nutzer.einladen",
    "nutzer.sperren",
  );
  const supabase = await createClient();
  // Explizit auf die eigene Behörde filtern (Defense-in-Depth zusätzlich zur RLS).
  const behoerdeId = profile.behoerde_id as string;
  const [{ data }, { data: rollenData }, { data: ausschlussData }] =
    await Promise.all([
      supabase
        .from("profile")
        .select("*")
        .eq("behoerde_id", behoerdeId)
        .order("name", { ascending: true }),
      supabase
        .from("rolle")
        .select("id, name")
        .eq("behoerde_id", behoerdeId)
        .order("reihenfolge", { ascending: true }),
      supabase
        .from("behoerde_ausschluss")
        .select("id, email, erstellt_at")
        .eq("behoerde_id", behoerdeId)
        .order("erstellt_at", { ascending: false }),
    ]);
  const nutzer = (data ?? []) as Profile[];
  const rollen = (rollenData ?? []) as { id: string; name: string }[];
  const ausgeschlossene = (ausschlussData ?? []) as {
    id: string;
    email: string;
    erstellt_at: string;
  }[];

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <div>
        <Link
          href="/einstellungen"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Einstellungen
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Nutzer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rollen vergeben, Konten sperren oder entfernen. Neue Personen mit
          einer Domain eurer Behörde werden beim ersten Login automatisch als
          Telefonist:in aufgenommen.
        </p>
      </div>

      <NutzerVerwaltung
        nutzer={nutzer}
        selbst={profile}
        rollen={rollen}
        ausgeschlossene={ausgeschlossene}
      />
    </main>
  );
}
