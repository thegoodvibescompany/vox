import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  AktuellesProfil,
  OnboardingStatus,
  Permission,
  Profile,
} from "@/lib/types";

/**
 * Lädt das Profile des aktuell eingeloggten Users via ensure_profile-RPC und
 * reichert es um Rollenname + Permissions an (RBAC).
 * Legt fehlendes Profile automatisch an (Self-healing) — verhindert die
 * Endlos-Schleife / ↔ /login, wenn auth.users existiert, public.profile aber
 * (z.B. nach Profile-Reset im Test) fehlt.
 *
 * Gibt null zurück, wenn nicht eingeloggt. Wirft bei RPC-Fehlern — Next.js
 * zeigt dann error.tsx statt zu redirecten (kein Schleifen-Risiko mehr).
 */
async function getCurrentProfile(): Promise<AktuellesProfil | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("ensure_profile");
  if (error) {
    throw new Error(`ensure_profile fehlgeschlagen: ${error.message}`);
  }
  // SETOF-RPC liefert Array; ensure_profile produziert genau eine Row.
  const row = (Array.isArray(data) ? data[0] : data) as Profile | undefined;
  if (!row) return null;

  // Rolle + Rechte auflösen. RLS auf `rolle` erlaubt das Lesen der eigenen
  // Behörden-Rolle. Ohne zugeordnete Rolle bleibt der Nutzer rechtlos (sieht
  // nichts) — sicher, bis das Onboarding eine Rolle setzt.
  let rolle_name: string | null = null;
  let permissions: Permission[] = [];
  if (row.rolle_id) {
    const { data: rolle } = await supabase
      .from("rolle")
      .select("name, permissions")
      .eq("id", row.rolle_id)
      .maybeSingle();
    if (rolle) {
      rolle_name = rolle.name;
      permissions = (rolle.permissions ?? []) as Permission[];
    }
  }

  return { ...row, rolle_name, permissions };
}

/**
 * Setzt einen eingeloggten + aktiven Nutzer voraus.
 * - Nicht eingeloggt → /login
 * - Eingeloggt, aber aktiv=false → /konto-deaktiviert
 */
export async function requireProfile(): Promise<AktuellesProfil> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.aktiv) redirect("/konto-deaktiviert");
  return profile;
}

/**
 * Onboarding-Zustand des eingeloggten Nutzers (RPC mein_onboarding_status).
 * Schaltzentrale fürs Routing — siehe onboardingPfad().
 */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mein_onboarding_status");
  if (error) {
    throw new Error(`mein_onboarding_status fehlgeschlagen: ${error.message}`);
  }
  return (data as OnboardingStatus | null) ?? "nicht_eingeloggt";
}

/**
 * Zielroute je Onboarding-Status. Eine Quelle der Wahrheit, damit das Gate
 * (requireMitglied) und die Onboarding-Seiten dieselbe Logik teilen.
 */
export function onboardingPfad(status: OnboardingStatus): string {
  switch (status) {
    case "mitglied":
      return "/";
    case "gesperrt":
      return "/onboarding/gesperrt";
    case "nicht_eingeloggt":
      return "/login";
    case "kann_gruenden":
    default:
      return "/onboarding";
  }
}

/**
 * Setzt ein vollwertiges Behörden-Mitglied voraus (eingeloggt + aktiv +
 * Behörde + Rolle). Wer noch kein Mitglied ist, wird anhand seines
 * Onboarding-Status auf die passende Onboarding-Route geleitet (Wizard,
 * Warte- oder Gesperrt-Screen). Gate für den gesamten (app)-Bereich.
 *
 * Im Normalfall (Mitglied) kostet das KEINEN Extra-RPC: behoerde_id + rolle_id
 * liegen bereits im Profil; der Status-RPC läuft nur für Nicht-Mitglieder.
 */
export async function requireMitglied(): Promise<AktuellesProfil> {
  const profile = await requireProfile();
  if (profile.behoerde_id && profile.rolle_id) return profile;
  // Wer (noch) keiner Behörde angehört, durchläuft das Onboarding — auch ein
  // Plattform-Admin gründet/betritt zuerst eine Behörde (das Flag bleibt; die
  // Behördenübersicht liegt dann unter /einstellungen/behoerden).
  const status = await getOnboardingStatus();
  redirect(onboardingPfad(status));
}

/**
 * Setzt einen Plattform-Betreiber voraus (profile.ist_plattform_admin). Gate für
 * die Behördenübersicht (/einstellungen/behoerden), die über allen Mandanten
 * steht. Wer das Flag nicht hat, landet auf /.
 */
export async function requirePlattformAdmin(): Promise<AktuellesProfil> {
  const profile = await requireProfile();
  if (!profile.ist_plattform_admin) redirect("/");
  return profile;
}

/**
 * Reiner Permission-Check gegen ein bereits geladenes Profil.
 * Für UX (Buttons ein-/ausblenden). Die echte Sicherheit liegt in der RLS.
 */
export function hatRecht(
  profile: { permissions: Permission[] },
  recht: Permission,
): boolean {
  return profile.permissions.includes(recht);
}

/**
 * Setzt mindestens eines der genannten Rechte voraus; sonst redirect auf /.
 * Defense in Depth: ergänzt die RLS auf Anwendungsebene.
 */
export async function requireRecht(
  ...rechte: Permission[]
): Promise<AktuellesProfil> {
  const profile = await requireProfile();
  if (!rechte.some((r) => profile.permissions.includes(r))) redirect("/");
  return profile;
}
