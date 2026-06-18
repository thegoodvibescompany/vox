import Link from "next/link";
import { requireRecht } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RollenEditor } from "./rollen-editor";
import type { Rolle } from "@/lib/types";

export default async function EinstellungenRollenPage() {
  const profile = await requireRecht("behoerde.konfigurieren");
  const supabase = await createClient();
  // Explizit auf die eigene Behörde filtern (Defense-in-Depth zusätzlich zur RLS).
  const behoerdeId = profile.behoerde_id as string;
  const [{ data: rollenData }, { data: profileData }] = await Promise.all([
    supabase
      .from("rolle")
      .select("*")
      .eq("behoerde_id", behoerdeId)
      .order("reihenfolge", { ascending: true }),
    supabase.from("profile").select("rolle_id").eq("behoerde_id", behoerdeId),
  ]);
  const rollen = (rollenData ?? []) as Rolle[];

  const mitgliederProRolle: Record<string, number> = {};
  for (const p of (profileData ?? []) as { rolle_id: string | null }[]) {
    if (p.rolle_id)
      mitgliederProRolle[p.rolle_id] = (mitgliederProRolle[p.rolle_id] ?? 0) + 1;
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div>
        <Link
          href="/einstellungen"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Einstellungen
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Organigramm</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lege fest, welche Rollen es in deiner Behörde gibt und welche Rechte
          jede Rolle hat. Die Baumstruktur bildet euer Organigramm ab und ist
          rein visuell, sie vergibt keine Rechte.
        </p>
      </div>

      <RollenEditor
        rollen={rollen}
        mitgliederProRolle={mitgliederProRolle}
        eigeneRolleId={profile.rolle_id}
      />
    </main>
  );
}
