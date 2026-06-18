import { redirect } from "next/navigation";
import { hatRecht, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAktiveLage } from "@/lib/lage";
import { FAQsListe } from "./faqs-liste";
import type { FAQ, Kategorie } from "@/lib/types";

export default async function AlleFAQsPage() {
  const profile = await requireProfile();
  const lage = await getAktiveLage();

  // Ohne aktive Lage: zurück zur Übersicht (einzige "keine Lage"-Stelle).
  if (!lage) redirect("/");

  const supabase = await createClient();
  const istLeitungUser = hatRecht(profile, "faq.bearbeiten");
  let faqQuery = supabase
    .from("faq")
    .select("*")
    .eq("lage_id", lage.id)
    .order("stand_at", { ascending: false });
  // Telefonist:innen sehen nur sichtbare FAQs — versteckte sind reine
  // Leitungs-Drafts, bevor sie freigeschaltet werden.
  if (!istLeitungUser) faqQuery = faqQuery.eq("sichtbar", true);

  const [faqsRes, katRes] = await Promise.all([
    faqQuery,
    supabase
      .from("kategorie")
      .select("*")
      .eq("lage_id", lage.id)
      .order("reihenfolge", { ascending: true }),
  ]);
  const faqs = (faqsRes.data ?? []) as FAQ[];
  const kategorien = (katRes.data ?? []) as Kategorie[];

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-semibold">FAQs</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Lage: {lage.name} — {faqs.length} Einträge
      </p>

      <FAQsListe
        faqs={faqs}
        kategorien={kategorien}
        darfBearbeiten={istLeitungUser}
      />
    </main>
  );
}
