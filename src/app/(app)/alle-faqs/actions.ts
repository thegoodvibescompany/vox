"use server";

import { revalidatePath } from "next/cache";
import { requireRecht } from "@/lib/auth";
import { getAktiveLage } from "@/lib/lage";
import { createClient } from "@/lib/supabase/server";

export type FAQActionState = {
  ok: boolean;
  message: string;
  id?: string;
};

type FAQEingabe = {
  frage: string;
  antwort: string;
  kategorie_id: string | null;
  interne_notiz: string | null;
  sichtbar: boolean;
};

function bereinigeEingabe(input: FAQEingabe): FAQEingabe | string {
  const frage = input.frage.trim();
  const antwort = input.antwort.trim();
  if (frage.length < 3) return "Frage ist zu kurz.";
  if (antwort.length < 3) return "Antwort ist zu kurz.";
  return {
    frage,
    antwort,
    kategorie_id: input.kategorie_id || null,
    interne_notiz: input.interne_notiz?.trim() || null,
    sichtbar: input.sichtbar,
  };
}

function revalidiereFAQSeiten() {
  revalidatePath("/alle-faqs");
  revalidatePath("/");
  revalidatePath("/themen", "page");
}

export async function erstelleFAQ(input: FAQEingabe): Promise<FAQActionState> {
  const profile = await requireRecht("faq.erstellen");
  const lage = await getAktiveLage();
  if (!lage) return { ok: false, message: "Keine aktive Lage." };

  const sauber = bereinigeEingabe(input);
  if (typeof sauber === "string") return { ok: false, message: sauber };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faq")
    .insert({
      lage_id: lage.id,
      kategorie_id: sauber.kategorie_id,
      frage: sauber.frage,
      antwort: sauber.antwort,
      interne_notiz: sauber.interne_notiz,
      sichtbar: sauber.sichtbar,
      autor_id: profile.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidiereFAQSeiten();
  return { ok: true, message: "FAQ angelegt.", id: data?.id };
}

export async function aktualisiereFAQ(
  id: string,
  input: FAQEingabe,
): Promise<FAQActionState> {
  await requireRecht("faq.bearbeiten");
  const sauber = bereinigeEingabe(input);
  if (typeof sauber === "string") return { ok: false, message: sauber };

  const supabase = await createClient();
  const { error } = await supabase
    .from("faq")
    .update({
      kategorie_id: sauber.kategorie_id,
      frage: sauber.frage,
      antwort: sauber.antwort,
      interne_notiz: sauber.interne_notiz,
      sichtbar: sauber.sichtbar,
      stand_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidiereFAQSeiten();
  return { ok: true, message: "FAQ aktualisiert." };
}

export async function loescheFAQ(id: string): Promise<FAQActionState> {
  await requireRecht("faq.loeschen");
  const supabase = await createClient();
  const { error } = await supabase.from("faq").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidiereFAQSeiten();
  return { ok: true, message: "FAQ gelöscht." };
}

// ─────────────────────────────────────────────────────────────
// Änderungsverlauf einer FAQ (Tabelle faq_version)
// ─────────────────────────────────────────────────────────────

export type FaqVerlaufVersion = {
  version: number;
  frage: string;
  antwort: string;
  interne_notiz: string | null;
  geaendert_at: string | null;
  geaendert_von_name: string | null;
};

export type FaqVerlaufDaten = {
  aktuell: {
    version: number;
    frage: string;
    antwort: string;
    interne_notiz: string | null;
    stand_at: string;
  };
  // Ursprung der FAQ (Anlage) — bildet den untersten Punkt der Timeline.
  angelegt: {
    von_name: string | null;
    at: string;
  };
  versionen: FaqVerlaufVersion[];
};

export type FaqVerlaufResult =
  | { ok: true; verlauf: FaqVerlaufDaten }
  | { ok: false; message: string };

/**
 * Lädt die Versionshistorie einer FAQ. Die aktuelle Fassung stammt aus `faq`,
 * die früheren aus `faq_version` (vom Trigger archive_faq_version befüllt,
 * jeweils der Zustand VOR einer inhaltlichen Änderung). Namen der
 * bearbeitenden Personen werden aufgelöst. faq_version ist per RLS nur für
 * faq.bearbeiten-Berechtigte lesbar — requireRecht doppelt das auf
 * Anwendungsebene ab.
 */
export async function ladeFaqVerlauf(
  faqId: string,
): Promise<FaqVerlaufResult> {
  await requireRecht("faq.bearbeiten");
  const supabase = await createClient();

  const [faqRes, versionenRes] = await Promise.all([
    supabase
      .from("faq")
      .select("frage, antwort, interne_notiz, version, stand_at, created_at, autor_id")
      .eq("id", faqId)
      .single(),
    supabase
      .from("faq_version")
      .select(
        "version, frage, antwort, interne_notiz, geaendert_at, geaendert_von",
      )
      .eq("faq_id", faqId)
      .order("version", { ascending: false }),
  ]);

  if (faqRes.error || !faqRes.data) {
    return { ok: false, message: "FAQ nicht gefunden." };
  }
  const versionenRoh = versionenRes.data ?? [];

  // Bearbeiter- und Ersteller-Namen in einem Rutsch auflösen.
  const ids = Array.from(
    new Set(
      [
        ...versionenRoh.map((v) => v.geaendert_von),
        faqRes.data.autor_id,
      ].filter((id): id is string => Boolean(id)),
    ),
  );
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profile } = await supabase
      .from("profile")
      .select("id, name, email")
      .in("id", ids);
    for (const p of profile ?? []) {
      nameById.set(p.id, p.name || p.email);
    }
  }

  const versionen: FaqVerlaufVersion[] = versionenRoh.map((v) => ({
    version: v.version,
    frage: v.frage,
    antwort: v.antwort,
    interne_notiz: v.interne_notiz,
    geaendert_at: v.geaendert_at,
    geaendert_von_name: v.geaendert_von
      ? (nameById.get(v.geaendert_von) ?? null)
      : null,
  }));

  return {
    ok: true,
    verlauf: {
      aktuell: {
        version: faqRes.data.version,
        frage: faqRes.data.frage,
        antwort: faqRes.data.antwort,
        interne_notiz: faqRes.data.interne_notiz,
        stand_at: faqRes.data.stand_at,
      },
      angelegt: {
        von_name: faqRes.data.autor_id
          ? (nameById.get(faqRes.data.autor_id) ?? null)
          : null,
        at: faqRes.data.created_at,
      },
      versionen,
    },
  };
}

