import { redirect } from "next/navigation";
import { hatRecht, requireProfile } from "@/lib/auth";
import { getAktiveLage } from "@/lib/lage";
import { formatDeDatumZeit } from "@/lib/lage-utils";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  FrageStatusBadge,
  FreigabeNoetigBadge,
} from "@/components/frage-status-badge";
import { FrageErfassenDialog } from "@/components/frage-erfassen-dialog";
import { FrageLeitungAktionen } from "@/components/frage-leitung-aktionen";
import { FrageInfoPopover } from "@/components/frage-info-popover";
import { FachstellenVerlauf } from "@/components/fachstellen-verlauf";
import { DashboardRealtime } from "@/components/dashboard-realtime";
import type {
  Buergerfrage,
  FachstellenNachricht,
  Kategorie,
  Profile,
} from "@/lib/types";

type ViewRow = Buergerfrage & { anzeige_status: string };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const lage = await getAktiveLage();
  const supabase = await createClient();

  // Ohne aktive Lage gibt es nur die Übersicht (dort der "keine Lage"-Hinweis
  // bzw. der Lage-starten-CTA). Direktaufrufe/Bookmarks landen dort.
  if (!lage) redirect("/");

  const [fragenRes, katRes, profilesRes] = await Promise.all([
    supabase
      .from("buergerfrage_view")
      .select("*")
      .eq("lage_id", lage.id)
      .order("erfasst_at", { ascending: false }),
    supabase
      .from("kategorie")
      .select("*")
      .eq("lage_id", lage.id)
      .order("reihenfolge"),
    supabase.from("profile").select("id, name, email"),
  ]);

  const fragen = (fragenRes.data ?? []) as ViewRow[];
  const kategorien = (katRes.data ?? []) as Kategorie[];
  const profiles = (profilesRes.data ?? []) as Pick<Profile, "id" | "name" | "email">[];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const leitung = hatRecht(profile, "anfrage.freigeben");

  // Referenzierte FAQs für Rückfragen laden. Eine Bürgeranfrage mit gesetztem
  // bezug_faq_id ist eine Rückfrage zu einem bestehenden FAQ; dessen Frage und
  // Antwort werden als Kontext direkt auf der Kachel gezeigt.
  const bezugFaqIds = Array.from(
    new Set(
      fragen.map((f) => f.bezug_faq_id).filter((x): x is string => Boolean(x)),
    ),
  );
  const bezugFaqById = new Map<string, { frage: string; antwort: string }>();
  if (bezugFaqIds.length > 0) {
    const { data: bezugFaqs } = await supabase
      .from("faq")
      .select("id, frage, antwort")
      .in("id", bezugFaqIds);
    for (const q of (bezugFaqs ?? []) as {
      id: string;
      frage: string;
      antwort: string;
    }[]) {
      bezugFaqById.set(q.id, { frage: q.frage, antwort: q.antwort });
    }
  }

  // Schriftwechsel-Verlauf je Anfrage (nur Leitung; RLS erlaubt nur ihr SELECT).
  const nachrichtenByFrage = new Map<string, FachstellenNachricht[]>();
  if (leitung && fragen.length > 0) {
    const { data: nachrichten } = await supabase
      .from("fachstellen_nachricht")
      .select(
        "id, buergerfrage_id, richtung, text, autor_email, autor_name, created_at",
      )
      .in(
        "buergerfrage_id",
        fragen.map((f) => f.id),
      )
      .order("created_at", { ascending: true });
    for (const n of (nachrichten ?? []) as FachstellenNachricht[]) {
      const arr = nachrichtenByFrage.get(n.buergerfrage_id) ?? [];
      arr.push(n);
      nachrichtenByFrage.set(n.buergerfrage_id, arr);
    }
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <DashboardRealtime />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Bürgeranfragen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {fragen.length} {fragen.length === 1 ? "Anfrage" : "Anfragen"}
          </p>
        </div>
        <FrageErfassenDialog />
      </div>

      <div className="mt-6 grid gap-3">
        {fragen.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Noch keine Bürgerfragen erfasst.
            </CardContent>
          </Card>
        )}
        {fragen.map((f) => {
          const erfasstVon = profileById.get(f.erfasst_von);
          const freigegebenVon = f.freigegeben_von
            ? profileById.get(f.freigegeben_von)
            : undefined;
          const istFreigegeben = f.status === "freigegeben";
          const zeigeFreigabeBadge =
            leitung && f.status === "antwort_eingegangen";
          const bezugFaq = f.bezug_faq_id
            ? bezugFaqById.get(f.bezug_faq_id)
            : undefined;
          // 1:1-Freigabe (keine Redaktion): schlicht "Freigegebene Antwort"
          // ohne Herkunfts-/Metazeile.
          const istFreigabe1zu1 =
            f.status === "freigegeben" && !f.antwort_redaktion;

          return (
            <Card
              key={f.id}
              id={`bf-${f.id}`}
              className="overflow-hidden scroll-mt-24 target:ring-2 target:ring-emerald-400"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FrageStatusBadge
                      darfFreigeben={leitung}
                      status={leitung ? f.status : f.anzeige_status}
                    />
                    {zeigeFreigabeBadge && <FreigabeNoetigBadge />}
                    {f.bezug_faq_id && (
                      <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                        Rückfrage zu FAQ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {formatDeDatumZeit(f.erfasst_at)}
                      {erfasstVon && ` · ${erfasstVon.name || erfasstVon.email}`}
                    </span>
                    {leitung && (
                      <FrageInfoPopover
                        frage={f}
                        erfasstVon={erfasstVon}
                        freigegebenVon={freigegebenVon}
                      />
                    )}
                  </div>
                </div>

                <p className="mt-3 font-medium leading-snug">{f.frage_text}</p>

                {f.bezug_faq_id && (
                  <div className="mt-3 rounded-md border bg-stone-50 p-3">
                    <div className="text-xs font-medium text-stone-700">
                      Rückfrage zu bestehendem FAQ
                    </div>
                    {bezugFaq ? (
                      <>
                        <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">
                          Frage
                        </div>
                        <div className="text-sm text-stone-900">
                          {bezugFaq.frage}
                        </div>
                        <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">
                          Bestehende Antwort
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-900">
                          {bezugFaq.antwort}
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-xs text-stone-500">
                        Das verknüpfte FAQ ist nicht mehr verfügbar.
                      </div>
                    )}
                  </div>
                )}

                {leitung && (
                  <FachstellenVerlauf
                    nachrichten={nachrichtenByFrage.get(f.id) ?? []}
                  />
                )}

                {/* Telefonist-Sicht: nur die freigegebene öffentliche Antwort */}
                {!leitung && f.antwort_oeffentlich && (
                  <div className="mt-3 rounded-md border bg-stone-50 p-3">
                    <div className="text-xs text-muted-foreground mb-1">
                      Antwort
                    </div>
                    <div className="whitespace-pre-wrap text-sm">
                      {f.antwort_oeffentlich}
                    </div>
                  </div>
                )}

                {/* Leitungs-Sicht: Redaktion (falls vorhanden) + Original der Fachstelle */}
                {leitung && f.antwort_redaktion && (
                  <div className="mt-3 rounded-md border bg-stone-50 p-3">
                    <div className="text-xs text-muted-foreground mb-1">
                      Freigegebene Antwort (
                      {freigegebenVon?.name ||
                        freigegebenVon?.email ||
                        "Leitung"}
                      )
                    </div>
                    <div className="whitespace-pre-wrap text-sm">
                      {f.antwort_redaktion}
                    </div>
                  </div>
                )}

                {leitung && f.antwort_text && (
                  <div className="mt-3 rounded-md border bg-stone-50 p-3">
                    <div
                      className={`text-xs font-medium text-stone-700${
                        istFreigabe1zu1 ? " mb-2" : ""
                      }`}
                    >
                      {f.antwort_redaktion
                        ? "Original der Fachstelle"
                        : istFreigabe1zu1
                          ? "Freigegebene Antwort"
                          : "Antwort der Fachstelle"}
                    </div>
                    {!istFreigabe1zu1 && (
                      <div className="text-xs text-stone-500 mb-2">
                        {[
                          f.antwort_von_name,
                          f.antwort_von_email,
                          f.antwort_at && formatDeDatumZeit(f.antwort_at),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-900">
                      {f.antwort_text}
                    </div>
                  </div>
                )}

                {leitung && !istFreigegeben && (
                  <div className="mt-3">
                    <FrageLeitungAktionen
                      frage={f}
                      kategorien={kategorien}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
