"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PERMISSION_GRUPPEN, type Permission, type Rolle } from "@/lib/types";
import {
  aktualisiereRolle,
  erstelleRolle,
  loescheRolle,
  type RolleEingabe,
} from "./actions";

export function RollenEditor({
  rollen,
  mitgliederProRolle,
  eigeneRolleId,
}: {
  rollen: Rolle[];
  mitgliederProRolle: Record<string, number>;
  eigeneRolleId: string | null;
}) {
  const router = useRouter();
  const [dialogOffen, setDialogOffen] = useState(false);
  const [bearbeite, setBearbeite] = useState<Rolle | null>(null);

  function oeffneNeu() {
    setBearbeite(null);
    setDialogOffen(true);
  }

  function oeffneBearbeite(r: Rolle) {
    setBearbeite(r);
    setDialogOffen(true);
  }

  const wurzeln = useMemo(
    () =>
      rollen
        .filter((r) => !r.parent_rolle_id)
        .sort((a, b) => a.reihenfolge - b.reihenfolge),
    [rollen],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={oeffneNeu}>
          <Plus className="h-4 w-4 mr-1" />
          Neue Rolle
        </Button>
      </div>

      {wurzeln.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Rollen angelegt.
        </p>
      ) : (
        <div className="overflow-x-auto pb-4">
          <OrgEbene
            rollen={rollen}
            parentId={null}
            mitgliederProRolle={mitgliederProRolle}
            eigeneRolleId={eigeneRolleId}
            onBearbeite={oeffneBearbeite}
            showVlineTop={false}
          />
        </div>
      )}

      <RolleDialog
        open={dialogOffen}
        onOpenChange={setDialogOffen}
        rolle={bearbeite}
        alleRollen={rollen}
        mitglieder={bearbeite ? (mitgliederProRolle[bearbeite.id] ?? 0) : 0}
        onGespeichert={() => router.refresh()}
      />
    </div>
  );
}

function OrgEbene({
  rollen,
  parentId,
  mitgliederProRolle,
  eigeneRolleId,
  onBearbeite,
  showVlineTop,
}: {
  rollen: Rolle[];
  parentId: string | null;
  mitgliederProRolle: Record<string, number>;
  eigeneRolleId: string | null;
  onBearbeite: (r: Rolle) => void;
  showVlineTop: boolean;
}) {
  const kinder = rollen
    .filter((r) => (r.parent_rolle_id ?? null) === parentId)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);

  if (kinder.length === 0) return null;

  return (
    <div className="org-children">
      {kinder.map((kind) => {
        const hatKinder = rollen.some((r) => r.parent_rolle_id === kind.id);
        const anzahl = mitgliederProRolle[kind.id] ?? 0;

        return (
          <div key={kind.id} className="org-node">
            {showVlineTop && (
              <div className="w-px h-4 bg-stone-200 mx-auto" />
            )}
            <div className="rounded-lg border bg-white px-3 py-2 inline-flex flex-col gap-1 min-w-[120px] max-w-[180px] shadow-sm">
              <div className="flex items-center justify-between gap-1">
                <div className="flex flex-wrap items-center gap-1 min-w-0">
                  <span className="font-medium text-sm truncate">{kind.name}</span>
                  {kind.ist_system && (
                    <span className="rounded bg-stone-100 px-1 py-0.5 text-[9px] text-stone-600 shrink-0">
                      System
                    </span>
                  )}
                  {kind.id === eigeneRolleId && (
                    <span className="rounded bg-sky-100 px-1 py-0.5 text-[9px] text-sky-700 shrink-0">
                      Meine
                    </span>
                  )}
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() => onBearbeite(kind)}
                  title="Bearbeiten"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {anzahl} {anzahl === 1 ? "Nutzer" : "Nutzer"} ·{" "}
                {kind.permissions.length}{" "}
                {kind.permissions.length === 1 ? "Recht" : "Rechte"}
              </div>
            </div>
            {hatKinder && (
              <div className="w-px h-4 bg-stone-200 mx-auto" />
            )}
            <OrgEbene
              rollen={rollen}
              parentId={kind.id}
              mitgliederProRolle={mitgliederProRolle}
              eigeneRolleId={eigeneRolleId}
              onBearbeite={onBearbeite}
              showVlineTop={true}
            />
          </div>
        );
      })}
    </div>
  );
}

function RolleDialog({
  open,
  onOpenChange,
  rolle,
  alleRollen,
  mitglieder,
  onGespeichert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rolle: Rolle | null;
  alleRollen: Rolle[];
  mitglieder: number;
  onGespeichert: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {open && (
          <RolleInhalt
            key={rolle?.id ?? "neu"}
            rolle={rolle}
            alleRollen={alleRollen}
            mitglieder={mitglieder}
            onSchliessen={() => onOpenChange(false)}
            onGespeichert={onGespeichert}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RolleInhalt({
  rolle,
  alleRollen,
  mitglieder,
  onSchliessen,
  onGespeichert,
}: {
  rolle: Rolle | null;
  alleRollen: Rolle[];
  mitglieder: number;
  onSchliessen: () => void;
  onGespeichert: () => void;
}) {
  const istNeu = !rolle;
  const [name, setName] = useState(rolle?.name ?? "");
  const [beschreibung, setBeschreibung] = useState(rolle?.beschreibung ?? "");
  const [parentId, setParentId] = useState<string>(rolle?.parent_rolle_id ?? "");
  const [permissions, setPermissions] = useState<Set<Permission>>(
    new Set((rolle?.permissions ?? []) as Permission[]),
  );
  const [pending, setPending] = useState(false);

  const moeglicheEltern = useMemo(() => {
    if (!rolle) return alleRollen;
    const verboten = new Set<string>([rolle.id]);
    const kinder = new Map<string, string[]>();
    for (const r of alleRollen) {
      if (r.parent_rolle_id) {
        const arr = kinder.get(r.parent_rolle_id) ?? [];
        arr.push(r.id);
        kinder.set(r.parent_rolle_id, arr);
      }
    }
    const stack = [...(kinder.get(rolle.id) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (verboten.has(id)) continue;
      verboten.add(id);
      for (const c of kinder.get(id) ?? []) stack.push(c);
    }
    return alleRollen.filter((r) => !verboten.has(r.id));
  }, [rolle, alleRollen]);

  function togglePermission(p: Permission) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function speichern() {
    setPending(true);
    const eingabe: RolleEingabe = {
      name,
      beschreibung: beschreibung || null,
      permissions: Array.from(permissions),
      parent_rolle_id: parentId || null,
    };
    const r = istNeu
      ? await erstelleRolle(eingabe)
      : await aktualisiereRolle(rolle!.id, eingabe);
    setPending(false);
    if (r.ok) {
      toast.success(r.message);
      onSchliessen();
      onGespeichert();
    } else {
      toast.error(r.message);
    }
  }

  async function loeschen() {
    if (!rolle) return;
    if (!confirm(`Rolle ${rolle.name} wirklich löschen?`)) return;
    setPending(true);
    const r = await loescheRolle(rolle.id);
    setPending(false);
    if (r.ok) {
      toast.success(r.message);
      onSchliessen();
      onGespeichert();
    } else {
      toast.error(r.message);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{istNeu ? "Neue Rolle" : "Rolle bearbeiten"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        {!istNeu && mitglieder > 0 && (
          <p className="text-xs text-muted-foreground">
            Diese Rolle ist aktuell {mitglieder}{" "}
            {mitglieder === 1 ? "Person" : "Personen"} zugewiesen. Änderungen an
            den Rechten wirken sofort für alle.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="rolle-name">Name</Label>
          <Input
            id="rolle-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Leitung Bürgertelefon"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rolle-beschreibung">Beschreibung (optional)</Label>
          <Textarea
            id="rolle-beschreibung"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            rows={2}
            placeholder="Wofür ist diese Rolle gedacht?"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rolle-parent">
            Übergeordnete Rolle (Position im Organigramm)
          </Label>
          <select
            id="rolle-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— keine (oberste Ebene) —</option>
            {moeglicheEltern.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          <Label>Rechte</Label>
          {PERMISSION_GRUPPEN.map((g) => (
            <div key={g.gruppe} className="rounded-md border p-3">
              <div className="text-sm font-medium mb-2">{g.gruppe}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.rechte.map((re) => (
                  <label
                    key={re.key}
                    className="flex items-start gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={permissions.has(re.key)}
                      onChange={() => togglePermission(re.key)}
                      className="mt-0.5 size-4 accent-stone-800"
                    />
                    <span>{re.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <DialogFooter className="sm:justify-between">
        {!istNeu && (
          <Button
            variant="outline"
            onClick={loeschen}
            disabled={pending}
            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Löschen
          </Button>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:ml-auto">
          <Button variant="outline" onClick={onSchliessen} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={speichern} disabled={pending || !name.trim()}>
            {pending ? "Speichere …" : istNeu ? "Anlegen" : "Speichern"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
