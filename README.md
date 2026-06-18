# VOX — Bürgertelefon für die Krisenkommunikation

[![Live-Demo](https://img.shields.io/badge/Live--Demo-vox--bayern.com-2ea44f)](https://vox-bayern.com)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e)

VOX ist eine mandantenfähige Webanwendung, mit der eine Behörde (Kommune,
Landkreis oder Regierung) ihr **Bürgertelefon im Krisenfall** intern
koordiniert. Telefonist:innen durchsuchen freigegebene Antworten in einer
FAQ-Wissensbasis und erfassen Fragen, die sie nicht selbst beantworten können.
Die Leitung leitet diese per Token-Link an die zuständige Fachstelle weiter,
gibt eingehende Antworten frei und pflegt die Lagekarte. Jede Freigabe wird
automatisch Teil der durchsuchbaren FAQ.

Mehrere Behörden teilen sich eine Instanz, ohne sich gegenseitig zu sehen
(Mandanten-Isolation auf Datenbankebene). Eine frische Installation startet
**leer**: Die erste Person legt ihre Behörde im Onboarding selbst an.

**Live-Demo:** [vox-bayern.com](https://vox-bayern.com) — öffentliche
Vorführinstanz mit Beispieldaten.

## Funktionsumfang

- **Lage** starten (leer oder aus Vorlage), Karten-Fokus festlegen, beenden.
- **FAQ-Wissensbasis** mit Kategorien, Sichtbarkeit, Änderungsverlauf, Klick-Telemetrie.
- **Bürgeranfragen-Workflow:** `neu → bei_fachstelle → antwort_eingegangen → freigegeben`.
- **Fachstellen** antworten **ohne Konto** über einen zeitlich begrenzten Token-Link.
- **Lagekarte** (Leaflet): Polygone, Linien, Punkte, Kreise; Adress-Check (Punkt-in-Fläche).
- **Rollen & Rechte** pro Behörde frei definierbar (RBAC), Nutzerverwaltung, Audit-Log.
- **Posteingang** mit serverseitigem Polling, persönliche Notizen, Hilfe-Center.

## Mandantenfähigkeit & Onboarding

- Jede fachliche Zeile gehört zu genau einer Behörde (`behoerde_id`).
- Die Behörde einer eingeloggten Person liefert die zentrale Funktion
  `aktuelle_behoerde_id()`; sie steckt in **jeder** RLS-Policy.
- **Self-Service-Onboarding:** Wer sich mit einer noch unbekannten,
  nicht-privaten E-Mail-Domain anmeldet, gründet eine neue Behörde und wird
  deren Administrator:in. Die Domain wird dabei auf die per Magic-Link
  bewiesene eigene E-Mail-Domain festgelegt (kein Domain-Squatting). Weitere
  Personen derselben Domain stellen einen Beitrittsantrag, den ein Admin
  freigibt.

## Tech-Stack

- **Next.js 16** (App Router, `proxy.ts` als Middleware) + **React 19** + **TypeScript**
- **Tailwind 4** + **shadcn/ui** (Base UI, `render`-Prop statt `asChild`)
- **Supabase** (PostgreSQL 15+, Auth/GoTrue, Row Level Security) — self-hosted oder Cloud
- **Leaflet** + **leaflet-draw** + **Turf** + **Nominatim** (Geokodierung) für die Karte
- **Nodemailer** (SMTP, Fachstellen-Mails) · **Vitest** (Tests)

## Architektur

**SSR-only:** Ausschließlich der Next.js-Server spricht mit Supabase (Server
Components, Server Actions, Session-Refresh in der Middleware) — nie der
Browser. Dadurch kann das Supabase-Gateway (Kong) im internen Netz bleiben und
muss nicht öffentlich erreichbar sein. Fast alle Mutationen laufen über **Server
Actions**, nicht über eine offene REST-API.

**RLS als Sicherheitsgrenze:** Der Server-Client nutzt ausschließlich den
anon/publishable-Key unter der Session des eingeloggten Nutzers; ein
`service_role`-Key kommt im App-Code **nicht** vor. Damit ist die Row Level
Security nicht umgehbar — sie ist die maßgebliche Schutzschicht, ergänzt durch
Permission-Guards in den Server Actions (Defense in Depth).

```
Browser ──HTTPS──> Next.js (SSR) ──intern──> Kong ──> PostgreSQL (RLS)
                                                      └─ GoTrue (Auth/Magic-Link)
```

### Sicherheitsmodell (Kurzüberblick)

- **Mandanten-Isolation:** jede Policy ist nach `behoerde_id = aktuelle_behoerde_id()` gescoped.
- **RBAC:** Rechte hängen an pro Behörde definierten Rollen (`hat_recht('...')`).
- **Fachstellen-Token:** 192-Bit-Zufallstoken, 7 Tage gültig, First-Answer-Wins.
- **Gesperrte Behörde:** `aktuelle_behoerde_id()` liefert NULL → harte DB-seitige Sperre.
- **Content-Security-Policy:** nonce-basiert pro Request; zusätzlich HSTS, `X-Frame-Options`, `X-Content-Type-Options`, Referrer-/Permissions-Policy.
- **Profil-Schutz:** ein Trigger verhindert Selbst-Eskalation (eigene Rolle, Behörde oder Plattform-Admin-Flag).

## Lokales Setup

Voraussetzungen: Node.js 20.9+ (Vorgabe von Next.js 16), die [Supabase CLI](https://supabase.com/docs/guides/local-development)
und Docker (für den lokalen Supabase-Stack).

```bash
npm install
cp .env.example .env.local      # Werte ausfüllen (siehe unten)

supabase start                  # lokaler Supabase-Stack (Postgres, Auth, Kong …)
supabase db reset               # wendet alle Migrationen auf eine frische DB an

npm run dev                     # http://localhost:3000
```

Die erste Anmeldung mit einer nicht-privaten Domain führt durch das Onboarding
(Behörde gründen). Danach unter `/einstellungen` eine Lage starten.

## Umgebungsvariablen

Vollständige Liste mit Erklärungen in [`.env.example`](.env.example). Kurz:

| Variable | Pflicht | Zweck |
|---|---|---|
| `SUPABASE_URL` | ja | URL des Supabase-Projekts/Gateways |
| `SUPABASE_PUBLISHABLE_KEY` | ja | anon/publishable-Key (**nicht** service_role) |
| `NEXT_PUBLIC_SITE_URL` | Prod | Basis für Magic-Link-Redirects |
| `SMTP_HOST` … `MAIL_FROM` | für Mailversand | SMTP-Relay für Fachstellen-Mails |

## Datenbank & Migrationen

Das Schema liegt vollständig in [`supabase/migrations/`](supabase/migrations).
Anwenden auf eine frische Datenbank:

```bash
supabase db reset                      # lokal (verwirft Daten, spielt alles neu ein)
# oder gegen eine bestehende DB einzeln, z. B. per psql:
#   psql "$DATABASE_URL" -f supabase/migrations/<datei>.sql
```

Eine frische DB ist **leer** (keine Behörde, keine Nutzer) — der erste Login
gründet die erste Behörde. Bei Schema-Änderungen `src/lib/types.ts` synchron
halten. SQL-Tests liegen unter `supabase/tests/`.

## Deployment / Self-Hosting

VOX läuft auf jeder Plattform, die Next.js (Node) ausführt, plus einer
Supabase-Instanz. Eine erprobte, datensparsame Topologie:

- **App-Server (öffentlich):** Next.js hinter einem Reverse-Proxy mit TLS.
- **Supabase-Stack (privat):** PostgreSQL + GoTrue + Kong im internen Netz;
  Kong wird **nicht** öffentlich exponiert (durch das SSR-only-Design möglich).

Zu setzen: die Umgebungsvariablen oben (App), eine SMTP-Strecke für die
Fachstellen-Mails sowie eine SMTP-Konfiguration in GoTrue für die Magic-Links.
Die Auth-Redirect-Allow-List in GoTrue muss alle erlaubten Origins enthalten.

## Tests & Qualität

```bash
npm run lint        # ESLint
npm run test:run    # Vitest (Logik-Funktionen unter src/lib/*.test.ts)
npm run build       # Produktions-Build
```

## Projektstruktur

Auszug der wichtigsten Pfade:

```
src/
├── app/
│   ├── (app)/              # Eingeloggter Bereich (Layout-Gate requireMitglied)
│   │   ├── dashboard/      # Bürgeranfragen
│   │   ├── karte/          # Lagekarte
│   │   ├── alle-faqs/      # FAQ-Verwaltung
│   │   ├── themen/[id]/    # FAQs einer Kategorie (Drill-down von der Übersicht)
│   │   ├── einstellungen/  # Lage, Nutzer, Rollen, Vorlagen, Audit, Behörden
│   │   └── hilfe/          # Hilfe-Center
│   ├── antworten/[token]/  # Token-Antwortseite für Fachstellen (kein Login)
│   ├── auth/ · login/ · onboarding/
├── components/             # UI (Header, Dialoge, Posteingang, Karte …)
│   └── ui/                 # shadcn/ui-Primitive
└── lib/
    ├── supabase/           # Server-/Proxy-Client + Config
    ├── auth.ts             # Profil-/Rollen-/Rechte-Guards
    ├── csp.ts · env.ts · mail.ts · types.ts · …
supabase/
├── migrations/             # vollständiges Schema (RLS, Funktionen, Trigger)
└── tests/                  # SQL-Tests
```
