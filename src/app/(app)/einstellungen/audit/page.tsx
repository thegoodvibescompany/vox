import Link from "next/link";
import { requireRecht } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDeDatumZeit } from "@/lib/lage-utils";
import { AuditFilter } from "./audit-filter";
import { AuditDiffToggle } from "./audit-diff-toggle";
import type { Profile } from "@/lib/types";

const LIMIT = 200;

const TABELLEN_OPT = [
  { value: "", label: "Alle Tabellen" },
  { value: "buergerfrage", label: "Bürgerfragen" },
  { value: "faq", label: "FAQs" },
  { value: "kartenobjekt", label: "Kartenobjekte" },
  { value: "lage", label: "Lagen" },
  { value: "profile", label: "Profile" },
];

const OP_OPT = [
  { value: "", label: "Alle Aktionen" },
  { value: "INSERT", label: "Anlegen" },
  { value: "UPDATE", label: "Ändern" },
  { value: "DELETE", label: "Löschen" },
];

const OP_LABEL: Record<string, string> = {
  INSERT: "Anlegen",
  UPDATE: "Ändern",
  DELETE: "Löschen",
};

const TABELLE_LABEL: Record<string, string> = {
  buergerfrage: "Bürgerfragen",
  faq: "FAQs",
  kartenobjekt: "Kartenobjekte",
  lage: "Lagen",
  profile: "Profile",
};

type AuditEintrag = {
  id: string;
  wer: string | null;
  was: string;
  tabelle: string | null;
  zeile_id: string | null;
  vorher: Record<string, unknown> | null;
  nachher: Record<string, unknown> | null;
  wann: string;
};

export default async function EinstellungenAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tabelle?: string; op?: string }>;
}) {
  await requireRecht("audit.einsehen");
  const params = await searchParams;
  const tabelleFilter = params.tabelle?.trim() || null;
  const opFilter = params.op?.trim() || null;

  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("id, wer, was, tabelle, zeile_id, vorher, nachher, wann")
    .order("wann", { ascending: false })
    .limit(LIMIT);

  if (tabelleFilter) query = query.eq("tabelle", tabelleFilter);
  if (opFilter) query = query.eq("was", opFilter);

  const [auditRes, profilesRes] = await Promise.all([
    query,
    supabase.from("profile").select("id, name, email"),
  ]);

  const eintraege = (auditRes.data ?? []) as AuditEintrag[];
  const profiles = (profilesRes.data ?? []) as Pick<Profile, "id" | "name" | "email">[];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      <div>
        <Link
          href="/einstellungen"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Einstellungen
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Dokumentation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verfolge, wann was passiert ist. Zeigt maximal {LIMIT} Einträge.
          Filter oben links anpassen, um ältere oder spezifische Aktionen zu
          finden.
        </p>
      </div>

      <AuditFilter
        tabelleOptionen={TABELLEN_OPT}
        opOptionen={OP_OPT}
        currentTabelle={tabelleFilter ?? ""}
        currentOp={opFilter ?? ""}
      />

      <p className="text-xs text-muted-foreground">
        {eintraege.length} {eintraege.length === 1 ? "Eintrag" : "Einträge"}
        {eintraege.length === LIMIT && " (Limit erreicht — bitte filtern)"}
      </p>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-stone-600 bg-stone-50">
            <tr>
              <th className="py-2 px-3 whitespace-nowrap">Wann</th>
              <th className="py-2 px-3">Wer</th>
              <th className="py-2 px-3">Tabelle</th>
              <th className="py-2 px-3">Aktion</th>
              <th className="py-2 px-3">Zeile</th>
              <th className="py-2 px-3">Diff</th>
            </tr>
          </thead>
          <tbody>
            {eintraege.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 px-3 text-center text-muted-foreground"
                >
                  Keine Einträge gefunden.
                </td>
              </tr>
            ) : (
              eintraege.map((e) => {
                const wer = e.wer ? profileById.get(e.wer) : null;
                return (
                  <tr key={e.id} className="border-t align-top">
                    <td className="py-2 px-3 whitespace-nowrap">
                      {formatDeDatumZeit(e.wann)}
                    </td>
                    <td className="py-2 px-3">
                      {wer ? wer.name || wer.email : "—"}
                    </td>
                    <td className="py-2 px-3">
                      {e.tabelle
                        ? TABELLE_LABEL[e.tabelle] ?? e.tabelle
                        : "—"}
                    </td>
                    <td className="py-2 px-3">{OP_LABEL[e.was] ?? e.was}</td>
                    <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                      {e.zeile_id ? e.zeile_id.slice(0, 8) : "—"}
                    </td>
                    <td className="py-2 px-3">
                      <AuditDiffToggle vorher={e.vorher} nachher={e.nachher} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
