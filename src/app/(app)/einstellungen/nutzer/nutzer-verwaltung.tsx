"use client";

import { useState } from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  speichereNutzerAenderungen,
  entferneNutzer,
  zulassenNutzer,
} from "../actions";
import type { Profile } from "@/lib/types";
import { toast } from "sonner";

type RolleOption = { id: string; name: string };
type Ausschluss = { id: string; email: string; erstellt_at: string };

type RolleFilter = "alle" | string;
type StatusFilter = "alle" | "aktiv" | "gesperrt";

export function NutzerVerwaltung({
  nutzer,
  selbst,
  rollen,
  ausgeschlossene,
}: {
  nutzer: Profile[];
  selbst: Profile;
  rollen: RolleOption[];
  ausgeschlossene: Ausschluss[];
}) {
  const router = useRouter();
  const [suche, setSuche] = useState("");
  const [rolleFilter, setRolleFilter] = useState<RolleFilter>("alle");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  // pendingRolle: id -> rolle_id (neue, noch nicht gespeicherte Rollenzuweisung)
  const [pendingRolle, setPendingRolle] = useState<Record<string, string>>({});
  const [pendingAktiv, setPendingAktiv] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function entfernen(id: string, name: string) {
    if (
      !confirm(
        `${name || "Diese Person"} aus der Behörde entfernen? Die Person verliert den Zugang und kann sich nicht erneut automatisch anmelden, bis du sie wieder zulässt.`,
      )
    )
      return;
    setBusyId(id);
    try {
      const r = await entferneNutzer(id);
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    } catch {
      toast.error("Aktion fehlgeschlagen. Bitte Seite neu laden.");
    } finally {
      setBusyId(null);
    }
  }

  async function zulassen(ausschlussId: string) {
    setBusyId(ausschlussId);
    try {
      const r = await zulassenNutzer(ausschlussId);
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    } catch {
      toast.error("Aktion fehlgeschlagen. Bitte Seite neu laden.");
    } finally {
      setBusyId(null);
    }
  }

  const rolleNameById = useMemo(
    () => new Map(rollen.map((r) => [r.id, r.name])),
    [rollen],
  );

  const hasPending =
    Object.keys(pendingRolle).length > 0 || Object.keys(pendingAktiv).length > 0;

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return nutzer.filter((n) => {
      const aktivDisplay = pendingAktiv[n.id] ?? n.aktiv;
      if (rolleFilter !== "alle") {
        const rolleDisplay = pendingRolle[n.id] ?? n.rolle_id ?? "";
        if (rolleDisplay !== rolleFilter) return false;
      }
      if (statusFilter === "aktiv" && !aktivDisplay) return false;
      if (statusFilter === "gesperrt" && aktivDisplay) return false;
      if (!q) return true;
      const name = (n.name || "").toLowerCase();
      const email = (n.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [nutzer, suche, rolleFilter, statusFilter, pendingRolle, pendingAktiv]);

  function onRolleChange(id: string, originalRolleId: string, neueRolleId: string) {
    setPendingRolle((prev) => {
      const next = { ...prev };
      if (neueRolleId === originalRolleId) delete next[id];
      else next[id] = neueRolleId;
      return next;
    });
  }

  function onAktivChange(id: string, originalAktiv: boolean, neuerWert: boolean) {
    setPendingAktiv((prev) => {
      const next = { ...prev };
      if (neuerWert === originalAktiv) delete next[id];
      else next[id] = neuerWert;
      return next;
    });
  }

  async function speichern() {
    setSaving(true);
    const alleIds = new Set([
      ...Object.keys(pendingRolle),
      ...Object.keys(pendingAktiv),
    ]);
    const aenderungen = Array.from(alleIds).map((id) => ({
      id,
      ...(pendingRolle[id] !== undefined ? { rolle_id: pendingRolle[id] } : {}),
      ...(pendingAktiv[id] !== undefined ? { aktiv: pendingAktiv[id] } : {}),
    }));
    try {
      const r = await speichereNutzerAenderungen(aenderungen);
      if (r.ok) {
        toast.success(r.message);
        setPendingRolle({});
        setPendingAktiv({});
      } else {
        toast.error(r.message);
      }
    } catch {
      toast.error("Speichern fehlgeschlagen. Bitte Seite neu laden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Nach Name oder E-Mail suchen …"
            className="h-9"
          />
          <select
            value={rolleFilter}
            onChange={(e) => setRolleFilter(e.target.value as RolleFilter)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="alle">Alle Rollen</option>
            {rollen.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="alle">Aktiv und gesperrt</option>
            <option value="aktiv">Nur aktiv</option>
            <option value="gesperrt">Nur gesperrt</option>
          </select>
        </div>
        {hasPending && (
          <Button onClick={speichern} disabled={saving} size="sm">
            {saving ? "Wird gespeichert …" : "Speichern"}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-stone-600 bg-stone-50">
            <tr>
              <th className="py-2 px-4">Name</th>
              <th className="py-2 px-4">E-Mail</th>
              <th className="py-2 px-4">Rolle</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4 text-right">Entfernen</th>
            </tr>
          </thead>
          <tbody>
            {gefiltert.map((n) => {
              const istSelbst = n.id === selbst.id;
              const originalRolleId = n.rolle_id ?? "";
              const rolleDisplay = pendingRolle[n.id] ?? originalRolleId;
              const aktivDisplay = pendingAktiv[n.id] ?? n.aktiv;
              const geaendert =
                pendingRolle[n.id] !== undefined || pendingAktiv[n.id] !== undefined;
              return (
                <tr
                  key={n.id}
                  className={`border-t${geaendert ? " bg-amber-50/60" : ""}`}
                >
                  <td className="py-2 px-4">{n.name || "—"}</td>
                  <td className="py-2 px-4">{n.email}</td>
                  <td className="py-2 px-4">
                    <select
                      value={rolleDisplay}
                      onChange={(e) =>
                        onRolleChange(n.id, originalRolleId, e.target.value)
                      }
                      disabled={istSelbst}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                    >
                      {/* Nutzer ohne zugewiesene Rolle (z. B. frisch beigetreten) */}
                      {!rolleNameById.has(rolleDisplay) && (
                        <option value={rolleDisplay}>— keine Rolle —</option>
                      )}
                      {rollen.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-4">
                    <select
                      value={aktivDisplay ? "aktiv" : "gesperrt"}
                      onChange={(e) =>
                        onAktivChange(n.id, n.aktiv, e.target.value === "aktiv")
                      }
                      disabled={istSelbst}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                    >
                      <option value="aktiv">Aktiv</option>
                      <option value="gesperrt">Gesperrt</option>
                    </select>
                  </td>
                  <td className="py-2 px-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={istSelbst || busyId === n.id}
                      onClick={() => entfernen(n.id, n.name)}
                      title={
                        istSelbst
                          ? "Das eigene Konto kann nicht entfernt werden"
                          : "Aus der Behörde entfernen"
                      }
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {gefiltert.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Keine Nutzer gefunden.
          </p>
        )}
      </div>

      {ausgeschlossene.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold">Ausgeschlossene Adressen</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Diese Adressen wurden entfernt und können sich nicht erneut
            automatisch anmelden. Über die Schaltfläche daneben erlaubst du den
            erneuten Beitritt per Domain-Login.
          </p>
          <ul className="mt-3 divide-y">
            {ausgeschlossene.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm">{a.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Entfernt am{" "}
                    {new Date(a.erstellt_at).toLocaleDateString("de-DE")}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === a.id}
                  onClick={() => zulassen(a.id)}
                >
                  Wieder zulassen
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
