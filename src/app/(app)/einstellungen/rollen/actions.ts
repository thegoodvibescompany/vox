"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRecht } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ALLE_PERMISSIONS, type Permission, type Rolle } from "@/lib/types";

export type RolleActionState = { ok: boolean; message: string };

export type RolleEingabe = {
  name: string;
  beschreibung: string | null;
  permissions: string[];
  parent_rolle_id: string | null;
};

const KONFIG: Permission = "behoerde.konfigurieren";

// Unbekannte/ungültige Permissions herausfiltern (der DB-CHECK würde sie ohnehin
// ablehnen — so gibt es vorher eine saubere Eingabe statt eines DB-Fehlers).
function bereinigePermissions(input: string[]): Permission[] {
  const erlaubt = new Set<string>(ALLE_PERMISSIONS);
  return Array.from(new Set(input.filter((p) => erlaubt.has(p)))) as Permission[];
}

async function ladeRollen(supabase: SupabaseClient): Promise<Rolle[]> {
  const { data } = await supabase
    .from("rolle")
    .select("*")
    .order("reihenfolge", { ascending: true });
  return (data ?? []) as Rolle[];
}

// Alle Nachfahren von rootId (ohne rootId selbst) — für den Zyklus-Schutz beim
// Setzen einer übergeordneten Rolle.
function sammleNachfahren(rollen: Rolle[], rootId: string): Set<string> {
  const kinder = new Map<string, string[]>();
  for (const r of rollen) {
    if (r.parent_rolle_id) {
      const arr = kinder.get(r.parent_rolle_id) ?? [];
      arr.push(r.id);
      kinder.set(r.parent_rolle_id, arr);
    }
  }
  const out = new Set<string>();
  const stack = [...(kinder.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of kinder.get(id) ?? []) stack.push(c);
  }
  return out;
}

export async function erstelleRolle(
  eingabe: RolleEingabe,
): Promise<RolleActionState> {
  const profile = await requireRecht(KONFIG);
  const name = eingabe.name.trim();
  if (!name) return { ok: false, message: "Bitte einen Namen für die Rolle angeben." };

  const permissions = bereinigePermissions(eingabe.permissions);
  const supabase = await createClient();
  const rollen = await ladeRollen(supabase);

  const parentId = eingabe.parent_rolle_id || null;
  if (parentId && !rollen.some((r) => r.id === parentId))
    return { ok: false, message: "Übergeordnete Rolle nicht gefunden." };

  const maxReihenfolge = rollen.reduce((m, r) => Math.max(m, r.reihenfolge), 0);

  const { error } = await supabase.from("rolle").insert({
    behoerde_id: profile.behoerde_id,
    name,
    beschreibung: eingabe.beschreibung?.trim() || null,
    permissions,
    parent_rolle_id: parentId,
    reihenfolge: maxReihenfolge + 1,
    ist_system: false,
  });
  if (error) {
    if (error.code === "23505")
      return { ok: false, message: "Es gibt bereits eine Rolle mit diesem Namen." };
    return { ok: false, message: error.message };
  }

  revalidatePath("/einstellungen/rollen");
  revalidatePath("/einstellungen");
  return { ok: true, message: "Rolle angelegt." };
}

export async function aktualisiereRolle(
  id: string,
  eingabe: RolleEingabe,
): Promise<RolleActionState> {
  await requireRecht(KONFIG);
  const name = eingabe.name.trim();
  if (!name) return { ok: false, message: "Bitte einen Namen für die Rolle angeben." };

  const permissions = bereinigePermissions(eingabe.permissions);
  const supabase = await createClient();
  const rollen = await ladeRollen(supabase);
  const ziel = rollen.find((r) => r.id === id);
  if (!ziel) return { ok: false, message: "Rolle nicht gefunden." };

  const parentId = eingabe.parent_rolle_id || null;
  if (parentId) {
    if (parentId === id)
      return { ok: false, message: "Eine Rolle kann sich nicht selbst übergeordnet sein." };
    if (!rollen.some((r) => r.id === parentId))
      return { ok: false, message: "Übergeordnete Rolle nicht gefunden." };
    if (sammleNachfahren(rollen, id).has(parentId))
      return {
        ok: false,
        message: "Die übergeordnete Rolle darf keine untergeordnete Rolle sein.",
      };
  }

  // Lockout-Schutz: die letzte Rolle mit dem Recht, die Behörde zu
  // konfigurieren, darf dieses Recht nicht verlieren (sonst sperrt sich die
  // Behörde aus der Verwaltung aus).
  if (ziel.permissions.includes(KONFIG) && !permissions.includes(KONFIG)) {
    const anzahlKonfig = rollen.filter((r) => r.permissions.includes(KONFIG)).length;
    if (anzahlKonfig <= 1)
      return {
        ok: false,
        message:
          "Das ist die einzige Rolle, die die Behörde verwalten darf. Vergib das Recht erst einer anderen Rolle.",
      };
  }

  const { error } = await supabase
    .from("rolle")
    .update({
      name,
      beschreibung: eingabe.beschreibung?.trim() || null,
      permissions,
      parent_rolle_id: parentId,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505")
      return { ok: false, message: "Es gibt bereits eine Rolle mit diesem Namen." };
    return { ok: false, message: error.message };
  }

  revalidatePath("/einstellungen/rollen");
  revalidatePath("/einstellungen");
  return { ok: true, message: "Rolle gespeichert." };
}

export async function loescheRolle(id: string): Promise<RolleActionState> {
  await requireRecht(KONFIG);
  const supabase = await createClient();
  const rollen = await ladeRollen(supabase);
  const ziel = rollen.find((r) => r.id === id);
  if (!ziel) return { ok: false, message: "Rolle nicht gefunden." };

  // Belegte Rolle nicht löschen — sonst würden ihre Nutzer rechtlos (FK setzt
  // rolle_id auf NULL).
  const { count } = await supabase
    .from("profile")
    .select("id", { count: "exact", head: true })
    .eq("rolle_id", id);
  if ((count ?? 0) > 0)
    return {
      ok: false,
      message: `Dieser Rolle sind noch ${count} Nutzer zugeordnet. Weise ihnen zuerst eine andere Rolle zu.`,
    };

  if (ziel.permissions.includes(KONFIG)) {
    const anzahlKonfig = rollen.filter((r) => r.permissions.includes(KONFIG)).length;
    if (anzahlKonfig <= 1)
      return {
        ok: false,
        message: "Die einzige Rolle, die die Behörde verwalten darf, kann nicht gelöscht werden.",
      };
  }

  const { error } = await supabase.from("rolle").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/einstellungen/rollen");
  revalidatePath("/einstellungen");
  return { ok: true, message: "Rolle gelöscht." };
}
