import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { kannVerwalten } from "@/lib/types";
import { getAktiveLage } from "@/lib/lage";
import { createClient } from "@/lib/supabase/server";

export default async function EinstellungenPage() {
  const profile = await requireProfile();
  const darfVerwalten = kannVerwalten(profile.permissions);
  const istPlattformAdmin = profile.ist_plattform_admin;
  // Einstellungen sind für Verwaltungsrechte ODER den Plattform-Betreiber
  // erreichbar (Letzterer sieht ggf. nur die Behördenübersicht).
  if (!darfVerwalten && !istPlattformAdmin) redirect("/");
  const darfKonfigurieren = profile.permissions.includes("behoerde.konfigurieren");
  const supabase = await createClient();
  const lage = await getAktiveLage();

  // profile/rolle explizit auf die eigene Behörde filtern (Defense-in-Depth
  // zusätzlich zur RLS). lage_vorlage/audit_log sind reine Fachdaten ohne
  // Plattform-Hebel und brauchen den Filter nicht.
  const behoerdeId = profile.behoerde_id as string;
  const [
    { count: nutzerCount },
    { count: gesperrtCount },
    { count: rollenCount },
    { count: vorlagenCount },
    { count: auditCount },
  ] = await Promise.all([
    supabase
      .from("profile")
      .select("id", { count: "exact", head: true })
      .eq("behoerde_id", behoerdeId),
    supabase
      .from("profile")
      .select("id", { count: "exact", head: true })
      .eq("behoerde_id", behoerdeId)
      .eq("aktiv", false),
    supabase
      .from("rolle")
      .select("id", { count: "exact", head: true })
      .eq("behoerde_id", behoerdeId),
    supabase.from("lage_vorlage").select("id", { count: "exact", head: true }),
    supabase.from("audit_log").select("id", { count: "exact", head: true }),
  ]);

  const lageInfo = lage ? `Aktiv: ${lage.name}` : "Keine Lage aktiv";

  const nutzerInfo = `${nutzerCount ?? 0} Nutzer${
    gesperrtCount && gesperrtCount > 0 ? ` · ${gesperrtCount} gesperrt` : ""
  }`;

  const rollenInfo = `${rollenCount ?? 0} Rollen`;

  const vorlagenInfo = `${vorlagenCount ?? 0} Vorlagen`;

  const auditInfo = `${auditCount ?? 0} Einträge in der Dokumentation`;

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
      </div>

      {darfVerwalten && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide">
            Betrieb
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Kachel
              href="/einstellungen/lage"
              titel="Lage"
              beschreibung="Lage starten, bearbeiten oder beenden."
              info={lageInfo}
            />
            <Kachel
              href="/einstellungen/vorlagen"
              titel="Vorlagen"
              beschreibung="Vorlagen für Szenarien pflegen."
              info={vorlagenInfo}
            />
            <Kachel
              href="/einstellungen/audit"
              titel="Dokumentation"
              beschreibung="Verfolge, wann was passiert ist."
              info={auditInfo}
            />
          </div>
        </section>
      )}

      {(darfVerwalten || istPlattformAdmin) && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide">
            Organisation
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {darfVerwalten && (
              <>
                <Kachel
                  href="/einstellungen/nutzer"
                  titel="Nutzer"
                  beschreibung="Rollen vergeben, Konten sperren oder entfernen."
                  info={nutzerInfo}
                />
                {darfKonfigurieren && (
                  <Kachel
                    href="/einstellungen/rollen"
                    titel="Organigramm"
                    beschreibung="Rollen anlegen und Rechte je Rolle festlegen."
                    info={rollenInfo}
                  />
                )}
              </>
            )}
            {istPlattformAdmin && (
              <Kachel
                href="/einstellungen/behoerden"
                titel="Plattform-Verwaltung"
                beschreibung="Alle Behörden der Plattform freigeben oder sperren."
                info="Behörden verwalten"
              />
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function Kachel({
  href,
  titel,
  beschreibung,
  info,
}: {
  href: string;
  titel: string;
  beschreibung: string;
  info: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border bg-white p-5 hover:bg-stone-50 transition-colors"
    >
      <div className="text-base font-semibold">{titel}</div>
      <p className="text-sm text-muted-foreground mt-1">{beschreibung}</p>
      <p className="mt-3 text-xs text-stone-700">{info}</p>
    </Link>
  );
}
