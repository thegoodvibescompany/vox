import Link from "next/link";
import { redirect } from "next/navigation";
import { hatRecht, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAktiveLage } from "@/lib/lage";
import { buttonVariants } from "@/components/ui/button";
import { StartseiteClient } from "@/components/startseite-client";
import { kannVerwalten } from "@/lib/types";
import type { FAQ, Kategorie } from "@/lib/types";

export default async function Home() {
  const profile = await requireProfile();
  const lage = await getAktiveLage();

  if (!lage) {
    // Ohne aktive Lage hat die Übersicht für Verwaltende (Leitung/Admin bzw.
    // Plattform-Betreiber) keinen Inhalt. Sie werden direkt in die
    // Einstellungen geleitet, von wo aus eine Lage gestartet wird.
    // Telefonist:innen bleiben auf dem Hinweis-Screen.
    if (kannVerwalten(profile.permissions) || profile.ist_plattform_admin) {
      redirect("/einstellungen");
    }
    const darfStarten = hatRecht(profile, "lage.verwalten");
    return (
      <main className="container mx-auto px-4 py-16 max-w-2xl text-center">
        <h1 className="text-2xl font-semibold">Keine Lage aktiv.</h1>
        <p className="mt-3 text-muted-foreground">
          {darfStarten
            ? "Starte eine Lage, damit Karte, Bürgeranfragen und FAQs verfügbar werden."
            : "Sobald die Verwaltung eine Lage startet, erscheinen hier FAQs und Themenkacheln."}
        </p>
        {darfStarten && (
          <Link
            href="/einstellungen/lage"
            className={buttonVariants({ size: "lg", className: "mt-6" })}
          >
            Lage starten
          </Link>
        )}
      </main>
    );
  }

  const supabase = await createClient();
  // Die Übersicht ist die Anlaufstelle im Anruf — hier zählen nur
  // veröffentlichte FAQs, auch für die Leitung. Versteckte Drafts bleiben der
  // FAQ-Verwaltung (/alle-faqs) vorbehalten.
  const [faqsRes, katRes] = await Promise.all([
    supabase
      .from("faq")
      .select("*")
      .eq("lage_id", lage.id)
      .eq("sichtbar", true)
      .order("stand_at", { ascending: false }),
    supabase
      .from("kategorie")
      .select("*")
      .eq("lage_id", lage.id)
      .order("reihenfolge", { ascending: true }),
  ]);

  const faqs = (faqsRes.data ?? []) as FAQ[];
  const kategorien = (katRes.data ?? []) as Kategorie[];

  return <StartseiteClient faqs={faqs} kategorien={kategorien} />;
}
