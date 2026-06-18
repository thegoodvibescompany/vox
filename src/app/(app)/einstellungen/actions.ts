"use server";

import { revalidatePath } from "next/cache";
import { hatRecht, requireProfile, requireRecht } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export type EinstellungenState = {
  ok: boolean;
  message: string;
};

export type VorlageEingabe = {
  name: string;
  kategorien: { name: string; reihenfolge: number }[];
  standard_faqs: { kategorie: string | null; frage: string; antwort: string }[];
};

type KartenFokus = {
  city: string;
  lat: number;
  lon: number;
};

/**
 * Parst das versteckte JSON aus KartenFokusInput. Gibt {ok, fokus|null} oder
 * eine Fehlermeldung zurück. Leerer String = bewusst „kein Fokus".
 */
function parseKartenFokus(
  raw: FormDataEntryValue | null,
): { ok: true; fokus: KartenFokus | null } | { ok: false; message: string } {
  if (!raw) return { ok: true, fokus: null };
  const text = String(raw).trim();
  if (!text) return { ok: true, fokus: null };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, message: "Karten-Fokus konnte nicht gelesen werden." };
  }
  if (!json || typeof json !== "object") {
    return { ok: false, message: "Karten-Fokus hat das falsche Format." };
  }
  const o = json as Record<string, unknown>;
  const city = typeof o.city === "string" ? o.city.trim() : "";
  const lat = typeof o.lat === "number" ? o.lat : NaN;
  const lon = typeof o.lon === "number" ? o.lon : NaN;
  if (!city || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, message: "Karten-Fokus unvollständig." };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, message: "Breitengrad außerhalb des gültigen Bereichs." };
  }
  if (lon < -180 || lon > 180) {
    return { ok: false, message: "Längengrad außerhalb des gültigen Bereichs." };
  }
  return { ok: true, fokus: { city, lat, lon } };
}

/** Default-Name, wenn keiner vergeben wird: „Lage vom TT.MM.JJJJ". */
function defaultLageName(): string {
  const datum = new Date().toLocaleDateString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `Lage vom ${datum}`;
}

export async function starteLage(
  _prev: EinstellungenState | undefined,
  formData: FormData,
): Promise<EinstellungenState> {
  await requireRecht("lage.verwalten");
  const vorlage_id = formData.get("vorlage_id") as string | null;
  const name = ((formData.get("name") as string | null) || "").trim();

  const fokusErgebnis = parseKartenFokus(formData.get("karten_fokus"));
  if (!fokusErgebnis.ok) return { ok: false, message: fokusErgebnis.message };
  const fokus = fokusErgebnis.fokus;

  const supabase = await createClient();

  // Zwei Wege: leere Lage (kein/leerer Vorlagen-Wert = Default) oder Lage aus
  // einer bestehenden Vorlage (liefert Kategorien + Standard-FAQs). Eine
  // Vorlage greift also nur, wenn sie aktiv gewählt wurde. Ohne Namen vergibt
  // das System einen Datums-Default.
  let neueLageId: string | null = null;
  if (!vorlage_id) {
    const { data, error } = await supabase.rpc("starte_leere_lage", {
      p_name: name || defaultLageName(),
    });
    if (error) return { ok: false, message: error.message };
    neueLageId = (data as string | null) ?? null;
  } else {
    const { data, error } = await supabase.rpc("starte_lage_aus_vorlage", {
      p_vorlage_id: vorlage_id,
      p_name: name || null,
    });
    if (error) return { ok: false, message: error.message };
    neueLageId = (data as string | null) ?? null;
  }

  if (neueLageId && fokus) {
    const { error: updErr } = await supabase
      .from("lage")
      .update({
        map_focus_city: fokus.city,
        map_center_lat: fokus.lat,
        map_center_lon: fokus.lon,
      })
      .eq("id", neueLageId as string);
    if (updErr) {
      return {
        ok: false,
        message: `Lage gestartet, Karten-Fokus konnte nicht gespeichert werden: ${updErr.message}`,
      };
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Lage gestartet." };
}

export async function aktualisiereAktiveLage(input: {
  name: string;
  karten_fokus_raw: string | null;
}): Promise<EinstellungenState> {
  await requireRecht("lage.verwalten");

  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name darf nicht leer sein." };

  const fokusErgebnis = parseKartenFokus(input.karten_fokus_raw);
  if (!fokusErgebnis.ok) return { ok: false, message: fokusErgebnis.message };
  const fokus = fokusErgebnis.fokus;

  const supabase = await createClient();
  const update: Record<string, unknown> = {
    name,
  };
  if (fokus) {
    update.map_focus_city = fokus.city;
    update.map_center_lat = fokus.lat;
    update.map_center_lon = fokus.lon;
  } else {
    update.map_focus_city = null;
    update.map_center_lat = null;
    update.map_center_lon = null;
  }

  const { error } = await supabase
    .from("lage")
    .update(update)
    .eq("aktiv", true);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Lage aktualisiert." };
}

export async function beendeLage(): Promise<EinstellungenState> {
  await requireRecht("lage.verwalten");
  const supabase = await createClient();
  const { error } = await supabase.rpc("beende_aktive_lage");
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Lage beendet." };
}

export async function speichereNutzerAenderungen(
  aenderungen: { id: string; rolle_id?: string; aktiv?: boolean }[],
): Promise<EinstellungenState> {
  const caller = await requireProfile();
  const willRollen = aenderungen.some((a) => a.rolle_id !== undefined);
  const willStatus = aenderungen.some((a) => a.aktiv !== undefined);
  // Rechteprüfung passend zur Änderungsart (Rolle vergeben vs. Konto sperren).
  if (willRollen && !hatRecht(caller, "nutzer.rollen_verwalten"))
    return { ok: false, message: "Keine Berechtigung, Rollen zu vergeben." };
  if (willStatus && !hatRecht(caller, "nutzer.sperren"))
    return { ok: false, message: "Keine Berechtigung, Konten zu sperren." };

  if (aenderungen.length === 0) return { ok: true, message: "Keine Änderungen." };

  for (const a of aenderungen) {
    if (a.id === caller.id)
      return { ok: false, message: "Das eigene Konto kann nicht über die Nutzerverwaltung geändert werden." };
  }

  const supabase = await createClient();

  // rolle_id gegen die Rollen der eigenen Behörde validieren — RLS auf `rolle`
  // beschränkt das SELECT bereits auf die eigene Behörde, daher genügt ein
  // Abgleich gegen die sichtbaren Rollen.
  const rolleIds = Array.from(
    new Set(aenderungen.map((a) => a.rolle_id).filter((x): x is string => Boolean(x))),
  );
  if (rolleIds.length > 0) {
    const { data: gueltige } = await supabase
      .from("rolle")
      .select("id")
      .in("id", rolleIds);
    const erlaubt = new Set((gueltige ?? []).map((r) => r.id));
    for (const id of rolleIds) {
      if (!erlaubt.has(id)) return { ok: false, message: "Ungültige Rolle." };
    }
  }

  const ergebnisse = await Promise.all(
    aenderungen.map((a) => {
      const update: Partial<{ rolle_id: string; aktiv: boolean }> = {};
      if (a.rolle_id !== undefined) update.rolle_id = a.rolle_id;
      if (a.aktiv !== undefined) update.aktiv = a.aktiv;
      if (Object.keys(update).length === 0) return Promise.resolve(null);
      return supabase.from("profile").update(update).eq("id", a.id);
    }),
  );
  const fehler = ergebnisse.find((r) => r?.error)?.error;
  if (fehler) return { ok: false, message: fehler.message };

  revalidatePath("/einstellungen");
  return {
    ok: true,
    message: `${aenderungen.length} Änderung${aenderungen.length === 1 ? "" : "en"} gespeichert.`,
  };
}

/**
 * Hartes Entfernen aus der eigenen Behörde: löst das Profil von der Behörde und
 * trägt die E-Mail in die Ausschlussliste, damit kein Auto-Rückkommen passiert.
 * Logik + Recht (nutzer.sperren) + Lockout-Schutz stecken in der RPC.
 */
export async function entferneNutzer(
  userId: string,
): Promise<EinstellungenState> {
  const caller = await requireProfile();
  if (!hatRecht(caller, "nutzer.sperren"))
    return { ok: false, message: "Keine Berechtigung, Nutzer zu entfernen." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("entferne_nutzer", { p_user_id: userId });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/einstellungen/nutzer");
  revalidatePath("/einstellungen");
  return { ok: true, message: "Nutzer entfernt und ausgeschlossen." };
}

/**
 * Hebt einen Ausschluss wieder auf (versehentlich Entfernte können dann erneut
 * per Domain-Login beitreten). RLS-delete-Policy verlangt nutzer.sperren +
 * eigene Behörde.
 */
export async function zulassenNutzer(
  ausschlussId: string,
): Promise<EinstellungenState> {
  const caller = await requireProfile();
  if (!hatRecht(caller, "nutzer.sperren"))
    return { ok: false, message: "Keine Berechtigung." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("behoerde_ausschluss")
    .delete()
    .eq("id", ausschlussId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/einstellungen/nutzer");
  return { ok: true, message: "Person wieder zugelassen." };
}

/**
 * Legt eine leere Vorlage an und gibt ihre Id zurück, damit der Aufrufer direkt
 * in den Editor springen kann. behoerde_id setzt der DEFAULT
 * (aktuelle_behoerde_id()); die RLS-insert-Policy verlangt vorlage.verwalten.
 */
export async function erstelleVorlage(): Promise<
  EinstellungenState & { id?: string }
> {
  await requireRecht("vorlage.verwalten");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lage_vorlage")
    .insert({ name: "Neue Vorlage" })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  revalidatePath("/einstellungen/vorlagen");
  return { ok: true, message: "Vorlage angelegt.", id: data.id as string };
}

export async function aktualisiereVorlage(
  id: string,
  eingabe: VorlageEingabe,
): Promise<EinstellungenState> {
  await requireRecht("vorlage.verwalten");

  const name = eingabe.name.trim();
  if (!name) return { ok: false, message: "Vorlagenname darf nicht leer sein." };

  const kategorien = eingabe.kategorien
    .map((k, i) => ({ name: k.name.trim(), reihenfolge: i }))
    .filter((k) => k.name.length > 0);

  const namen = kategorien.map((k) => k.name);
  const uniqueNamen = new Set(namen);
  if (uniqueNamen.size !== namen.length) {
    return { ok: false, message: "Kategorien-Namen müssen eindeutig sein." };
  }

  const faqs: { kategorie: string | null; frage: string; antwort: string }[] = [];
  for (const f of eingabe.standard_faqs) {
    const frage = f.frage.trim();
    const antwort = f.antwort.trim();
    if (!frage || !antwort) {
      return { ok: false, message: "Jede Standard-FAQ braucht Frage und Antwort." };
    }
    const kat = f.kategorie?.trim() || null;
    if (kat && !uniqueNamen.has(kat)) {
      return {
        ok: false,
        message: `FAQ verweist auf unbekannte Kategorie "${kat}".`,
      };
    }
    faqs.push({ kategorie: kat, frage, antwort });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("lage_vorlage")
    .update({
      name,
      kategorien,
      standard_faqs: faqs,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/einstellungen");
  return { ok: true, message: "Vorlage gespeichert." };
}
