import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { hatRecht, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAktiveLage } from "@/lib/lage";
import { ThemaListe } from "./thema-liste";
import type { FAQ, Kategorie } from "@/lib/types";

export default async function ThemaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;
  const lage = await getAktiveLage();
  // Ohne aktive Lage: zurück zur Übersicht (einzige "keine Lage"-Stelle),
  // konsistent mit Karte/Bürgeranfragen/FAQ. notFound() bleibt für eine
  // unbekannte/fremde Kategorie weiter unten.
  if (!lage) redirect("/");

  const supabase = await createClient();
  let faqQuery = supabase
    .from("faq")
    .select("*")
    .eq("lage_id", lage.id)
    .eq("kategorie_id", id)
    .order("stand_at", { ascending: false });
  if (!hatRecht(profile, "faq.bearbeiten")) faqQuery = faqQuery.eq("sichtbar", true);

  const [katRes, faqsRes] = await Promise.all([
    supabase.from("kategorie").select("*").eq("id", id).maybeSingle(),
    faqQuery,
  ]);

  const kategorie = katRes.data as Kategorie | null;
  if (!kategorie || kategorie.lage_id !== lage.id) notFound();

  const faqs = (faqsRes.data ?? []) as FAQ[];

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Zur Startseite
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">{kategorie.name}</h1>
      <p className="text-sm text-muted-foreground mt-1">
        {faqs.length} {faqs.length === 1 ? "Eintrag" : "Einträge"}
      </p>

      <div className="mt-6">
        <ThemaListe faqs={faqs} />
      </div>
    </main>
  );
}
