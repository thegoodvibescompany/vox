"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setzeBehoerdeStatus } from "./actions";
import { BEHOERDEN_TYPEN } from "@/lib/types";
import type { PlattformBehoerde } from "@/lib/types";

type Sortierung = "neueste" | "aelteste" | "name";

export function BehoerdenUebersicht({
  behoerden,
}: {
  behoerden: PlattformBehoerde[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suche, setSuche] = useState("");
  const [typFilter, setTypFilter] = useState<string>("alle");
  const [sortierung, setSortierung] = useState<Sortierung>("neueste");

  const sichtbar = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const liste = behoerden.filter((b) => {
      if (typFilter !== "alle" && (b.typ ?? "") !== typFilter) return false;
      if (q && !b.name.toLowerCase().includes(q)) return false;
      return true;
    });
    liste.sort((a, b) => {
      if (sortierung === "name") return a.name.localeCompare(b.name, "de");
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortierung === "neueste" ? db - da : da - db;
    });
    return liste;
  }, [behoerden, suche, typFilter, sortierung]);

  async function lauf(
    id: string,
    fn: () => Promise<{ ok: boolean; message: string }>,
  ) {
    setBusyId(id);
    try {
      const r = await fn();
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

  function sperrenUmschalten(b: PlattformBehoerde) {
    const sperren = b.status !== "gesperrt";
    if (
      sperren &&
      !confirm(
        `Behörde ${b.name} sperren? Die Mitglieder können die App dann nicht mehr nutzen.`,
      )
    )
      return;
    void lauf(b.id, () =>
      setzeBehoerdeStatus(b.id, sperren ? "gesperrt" : "aktiv"),
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Nach Name suchen …"
          className="h-9"
        />
        <select
          value={typFilter}
          onChange={(e) => setTypFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="alle">Alle Typen</option>
          {BEHOERDEN_TYPEN.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={sortierung}
          onChange={(e) => setSortierung(e.target.value as Sortierung)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="neueste">Neueste zuerst</option>
          <option value="aelteste">Älteste zuerst</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {sichtbar.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Behörden gefunden.</p>
      ) : (
        <div className="space-y-3">
          {sichtbar.map((b) => {
            const istBusy = busyId === b.id;
            return (
              <div key={b.id} className="rounded-lg border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{b.name}</span>
                      {b.status === "gesperrt" && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-800">
                          Gesperrt
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {b.typ ? `${b.typ} · ` : ""}
                      {b.mitglieder}{" "}
                      {b.mitglieder === 1 ? "Mitglied" : "Mitglieder"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={istBusy}
                      onClick={() => sperrenUmschalten(b)}
                      className={
                        b.status !== "gesperrt"
                          ? "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                          : ""
                      }
                    >
                      {b.status === "gesperrt" ? "Entsperren" : "Sperren"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
