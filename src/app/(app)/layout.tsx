import { redirect } from "next/navigation";
import { hatRecht, requireMitglied } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAktiveLage } from "@/lib/lage";
import { SiteHeader } from "@/components/site-header";
import type { PosteingangEintrag } from "@/components/posteingang";
import type { Notiz } from "@/lib/types";

type LeitungRow = {
  id: string;
  frage_text: string;
  status: string;
  erfasst_at: string | null;
  fachstelle_email: string | null;
};

type FaqUngelesenRow = {
  faq_id: string;
  frage: string;
  antwort: string;
  stand_at: string | null;
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireMitglied();
  const supabase = await createClient();

  // Hat der Plattform-Betreiber die Behörde gesperrt, ist die App für ihre
  // Mitglieder dicht. Ein Plattform-Admin umgeht die Sperre, damit
  // er seine Behörde über /einstellungen/behoerden wieder entsperren kann (sonst
  // Schleife: gesperrt -> /behoerde-gesperrt -> ...).
  const { data: meineBehoerde } = await supabase
    .from("behoerde")
    .select("status")
    .eq("id", profile.behoerde_id as string)
    .maybeSingle();
  if (meineBehoerde?.status === "gesperrt" && !profile.ist_plattform_admin)
    redirect("/behoerde-gesperrt");

  // Ohne aktive Lage sind die inhaltlichen Tabs (Karte/Bürgeranfragen/FAQ)
  // gegenstandslos -> Header blendet sie aus, nur Übersicht + Einstellungen
  // bleiben. Die Übersichtsseite zeigt dann den "keine Lage"-Hinweis.
  const lageAktiv = (await getAktiveLage()) !== null;

  const istLeitung = hatRecht(profile, "anfrage.freigeben");
  // FAQ-Benachrichtigungen sind für die Wissens-Nutzer gedacht. Wer FAQs selbst
  // pflegt (Leitung/Admin, Recht faq.bearbeiten), bekommt keine Benachrichtigung
  // über die eigene Veröffentlichung.
  const bekommtFaqBenachrichtigung = !hatRecht(profile, "faq.bearbeiten");

  const [notizenRes, eingehendRes, ungeleseneFaqsRes] = await Promise.all([
    supabase.from("notiz").select("*").order("created_at", { ascending: false }),
    // Leitung: Bürgerfragen, die eine Aktion brauchen (zuordnen/freigeben).
    // Telefonist:innen brauchen hier nichts — die freigegebene Antwort erreicht
    // sie über die FAQ-Benachrichtigung (jede Freigabe erzeugt ein FAQ).
    istLeitung
      ? supabase
          .from("buergerfrage_view")
          .select("id, frage_text, status, erfasst_at, fachstelle_email")
          .in("status", ["neu", "antwort_eingegangen"])
          .is("gelesen_von_leitung_at", null)
          .order("erfasst_at", { ascending: false })
      : null,
    bekommtFaqBenachrichtigung
      ? supabase
          .from("faq_ungelesen_pro_user")
          .select("faq_id, frage, antwort, stand_at")
          .order("stand_at", { ascending: false })
          .limit(20)
      : null,
  ]);

  const notizen = (notizenRes.data ?? []) as Notiz[];

  // Leitung: offene Bürgerfragen. Telefonist:innen: keine (nur FAQs unten).
  const leitungEintraege: PosteingangEintrag[] = istLeitung
    ? ((eingehendRes?.data ?? []) as LeitungRow[]).map((r) => ({
        id: r.id,
        quelle: "buergerfrage",
        titel: r.frage_text,
        vorschau:
          r.status === "antwort_eingegangen"
            ? "Antwort eingegangen — Freigabe nötig."
            : r.fachstelle_email
              ? `Neu — Fachstelle: ${r.fachstelle_email}`
              : "Neu erfasst — bitte zuordnen.",
        datum: r.erfasst_at,
        href: `/dashboard#bf-${r.id}`,
      }))
    : [];

  // Neue/aktualisierte FAQs — nur für Wissens-Nutzer (kein faq.bearbeiten).
  // Sortierung nach Datum absteigend, damit das Frischeste oben steht.
  const ungeleseneFaqs = (ungeleseneFaqsRes?.data ?? []) as FaqUngelesenRow[];
  const faqEintraege: PosteingangEintrag[] = ungeleseneFaqs.map((f) => ({
    id: f.faq_id,
    quelle: "faq",
    titel: f.frage,
    vorschau: f.antwort,
    datum: f.stand_at,
    href: `/alle-faqs#faq-${f.faq_id}`,
  }));

  const posteingang = [...leitungEintraege, ...faqEintraege].sort((a, b) => {
    const da = a.datum ? new Date(a.datum).getTime() : 0;
    const db = b.datum ? new Date(b.datum).getTime() : 0;
    return db - da;
  });

  return (
    <>
      <SiteHeader
        profile={profile}
        notizen={notizen}
        posteingang={posteingang}
        lageAktiv={lageAktiv}
      />
      <div className="flex-1">{children}</div>
    </>
  );
}
