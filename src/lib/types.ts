// Domain-Typen — händisch gepflegt. Bei Schema-Änderungen synchron halten.
// Optional später durch supabase gen types typescript ersetzen.

import type { Geometry } from "geojson";

// RBAC: feste Liste aller Permissions. Spiegelt den CHECK-Constraint
// rolle_permissions_gueltig in der DB. Bei Änderung beide Stellen synchron
// halten.
export const ALLE_PERMISSIONS = [
  "faq.lesen",
  "faq.erstellen",
  "faq.bearbeiten",
  "faq.loeschen",
  "faq.sichtbarkeit",
  "anfrage.erfassen",
  "anfrage.an_fachstelle",
  "anfrage.freigeben",
  "karte.ansehen",
  "karte.zeichnen",
  "karte.bearbeiten",
  "lage.verwalten",
  "vorlage.verwalten",
  "nutzer.einladen",
  "nutzer.rollen_verwalten",
  "nutzer.sperren",
  "behoerde.konfigurieren",
  "audit.einsehen",
] as const;

export type Permission = (typeof ALLE_PERMISSIONS)[number];

// Rechte, die den Zugang zum Einstellungsbereich rechtfertigen (Tab + Index).
const VERWALTUNGS_RECHTE: Permission[] = [
  "lage.verwalten",
  "vorlage.verwalten",
  "nutzer.einladen",
  "nutzer.rollen_verwalten",
  "nutzer.sperren",
  "behoerde.konfigurieren",
  "audit.einsehen",
];

// Reiner Check (client- und serverseitig nutzbar): darf der Nutzer mit diesen
// Rechten überhaupt in den Einstellungsbereich?
export function kannVerwalten(permissions: Permission[]): boolean {
  return permissions.some((p) => VERWALTUNGS_RECHTE.includes(p));
}

// Permissions nach Bereich gruppiert + sprechende Labels — einzige Quelle für
// den Rechte-Editor. Deckt alle Permissions aus ALLE_PERMISSIONS ab; bei
// Änderung dort hier mitziehen.
export const PERMISSION_GRUPPEN: {
  gruppe: string;
  rechte: { key: Permission; label: string }[];
}[] = [
  {
    gruppe: "FAQ",
    rechte: [
      { key: "faq.lesen", label: "ansehen und suchen" },
      { key: "faq.erstellen", label: "anlegen" },
      { key: "faq.bearbeiten", label: "ändern" },
      { key: "faq.loeschen", label: "löschen" },
      { key: "faq.sichtbarkeit", label: "für Bürger zeigen oder verstecken" },
    ],
  },
  {
    gruppe: "Bürgeranfragen",
    rechte: [
      { key: "anfrage.erfassen", label: "aufnehmen" },
      { key: "anfrage.an_fachstelle", label: "an Fachstelle senden" },
      { key: "anfrage.freigeben", label: "Antwort freigeben" },
    ],
  },
  {
    gruppe: "Karte",
    rechte: [
      { key: "karte.ansehen", label: "ansehen" },
      { key: "karte.zeichnen", label: "Objekte zeichnen" },
      { key: "karte.bearbeiten", label: "Objekte bearbeiten und löschen" },
    ],
  },
  {
    gruppe: "Lage",
    rechte: [{ key: "lage.verwalten", label: "starten, wechseln, beenden" }],
  },
  {
    gruppe: "Vorlagen",
    rechte: [{ key: "vorlage.verwalten", label: "pflegen" }],
  },
  {
    gruppe: "Nutzer",
    rechte: [
      { key: "nutzer.einladen", label: "einladen und Beitritte freigeben" },
      { key: "nutzer.rollen_verwalten", label: "Rollen zuweisen" },
      { key: "nutzer.sperren", label: "Konten sperren" },
    ],
  },
  {
    gruppe: "Behörde",
    rechte: [
      {
        key: "behoerde.konfigurieren",
        label: "Struktur, Rollen und Rechte verwalten",
      },
      { key: "audit.einsehen", label: "Dokumentation einsehen" },
    ],
  },
];

// Pro Behörde definierbare Rolle mit Permission-Set (Tabelle rolle).
export type Rolle = {
  id: string;
  behoerde_id: string;
  name: string;
  beschreibung: string | null;
  permissions: Permission[];
  parent_rolle_id: string | null;
  reihenfolge: number;
  ist_system: boolean;
  created_at: string;
  updated_at: string;
};

// Status eines Mandanten. Spiegelt den CHECK-Constraint auf behoerde.status;
// genutzt in der Plattform-Behördenübersicht (PlattformBehoerde).
type BehoerdeStatus = "aktiv" | "gesperrt";

// Die drei zulässigen Behördentypen (Wizard-Auswahl + Übersicht-Filter).
// Spiegelt den CHECK-Constraint behoerde_typ_gueltig in der DB.
export const BEHOERDEN_TYPEN = ["Kommune", "Landkreis", "Regierung"] as const;

// Eine Zeile der Behördenübersicht (RPC plattform_behoerden): Behörde +
// Mitgliederzahl über alle Mandanten.
export type PlattformBehoerde = {
  id: string;
  name: string;
  typ: string | null;
  slug: string;
  status: BehoerdeStatus;
  ablauf_at: string | null;
  created_at: string;
  mitglieder: number;
};

export type FrageStatus =
  | "neu"
  | "bei_fachstelle"
  | "antwort_eingegangen"
  | "freigegeben";

export type KartenTyp = "polygon" | "linie" | "punkt" | "kreis";

export type KartenFarbe =
  | "rot"
  | "orange"
  | "gelb"
  | "gruen"
  | "blau"
  | "lila"
  | "grau";

// Reine Zeile der Tabelle profile (DB-Spalten).
export type Profile = {
  id: string;
  email: string;
  name: string;
  rolle_id: string | null;
  aktiv: boolean;
  behoerde_id: string | null;
  ist_plattform_admin: boolean;
  created_at: string;
  updated_at: string;
};

// Der eingeloggte Nutzer inkl. aufgelöster Rolle + Rechte (von auth.ts
// angereichert). UI- und Action-Checks laufen über permissions.
export type AktuellesProfil = Profile & {
  rolle_name: string | null;
  permissions: Permission[];
};

// Onboarding-Zustand des eingeloggten Nutzers (RPC mein_onboarding_status).
// Schaltzentrale fürs Routing nach dem Login:
//   mitglied         -> Behörde + Rolle gesetzt -> in die App
//   kann_gruenden    -> unbekannte Behörden-Domain -> Onboarding-Wizard
//   gesperrt         -> Freemail/keine Domain/ausgeschlossen -> Hinweis-Screen
//   nicht_eingeloggt -> kein auth.uid()
export type OnboardingStatus =
  | "mitglied"
  | "kann_gruenden"
  | "gesperrt"
  | "nicht_eingeloggt";

export type Lage = {
  id: string;
  behoerde_id: string;
  name: string;
  aktiv: boolean;
  gestartet_at: string | null;
  beendet_at: string | null;
  map_focus_city: string | null;
  map_center_lat: number | null;
  map_center_lon: number | null;
  map_default_zoom: number | null;
  created_at: string;
  updated_at: string;
};

export type Kategorie = {
  id: string;
  behoerde_id: string;
  lage_id: string;
  name: string;
  reihenfolge: number;
  created_at: string;
};

export type FAQ = {
  id: string;
  behoerde_id: string;
  lage_id: string;
  kategorie_id: string | null;
  frage: string;
  antwort: string;
  interne_notiz: string | null;
  sichtbar: boolean;
  stand_at: string;
  autor_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  klick_zaehler: number;
};

export type Buergerfrage = {
  id: string;
  behoerde_id: string;
  lage_id: string;
  frage_text: string;
  kategorie_id: string | null;
  fachstelle_email: string | null;
  status: FrageStatus;
  antwort_text: string | null;
  antwort_von_email: string | null;
  antwort_von_name: string | null;
  antwort_at: string | null;
  antwort_redaktion: string | null;
  antwort_oeffentlich: string | null;
  erfasst_von: string;
  erfasst_at: string;
  freigegeben_von: string | null;
  freigegeben_at: string | null;
  ins_faq_id: string | null;
  bezug_faq_id: string | null;
  updated_at: string;
  gelesen_von_leitung_at: string | null;
};

// Eine Nachricht im Schriftwechsel zwischen Bürgertelefon-Leitung und
// Fachstelle. 'frage' = Rückfrage der Leitung, 'antwort' = Antwort der
// Fachstelle. Die Original-Frage und die jeweils aktuelle Antwort leben
// weiterhin direkt auf der Buergerfrage; hier landen die archivierten Runden.
export type FachstellenNachricht = {
  id: string;
  behoerde_id: string;
  buergerfrage_id: string;
  richtung: "frage" | "antwort";
  text: string;
  autor_email: string | null;
  autor_name: string | null;
  created_at: string;
};

export type Kartenobjekt = {
  id: string;
  behoerde_id: string;
  lage_id: string;
  typ: KartenTyp;
  geometry: Geometry;
  radius_m: number | null;
  titel: string;
  beschreibung: string | null;
  farbe: KartenFarbe;
  autor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Notiz = {
  id: string;
  behoerde_id: string;
  user_id: string;
  inhalt: string;
  created_at: string;
  updated_at: string;
};

export type LageVorlage = {
  id: string;
  behoerde_id: string;
  name: string;
  kategorien: { name: string; reihenfolge: number }[];
  standard_faqs: { kategorie: string; frage: string; antwort: string }[];
  created_at: string;
  updated_at: string;
};
