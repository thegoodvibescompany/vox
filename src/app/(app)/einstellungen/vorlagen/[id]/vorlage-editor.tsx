"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { aktualisiereVorlage } from "../../actions";
import type { LageVorlage } from "@/lib/types";

type Kat = { _key: string; name: string };
type FAQ = { _key: string; katKey: string | null; frage: string; antwort: string };

function neuerKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function vorlageZuState(vorlage: LageVorlage): { kats: Kat[]; faqs: FAQ[] } {
  const kats: Kat[] = vorlage.kategorien.map((k) => ({
    _key: neuerKey(),
    name: k.name,
  }));
  const nameToKey = new Map(kats.map((k) => [k.name, k._key]));
  const faqs: FAQ[] = vorlage.standard_faqs.map((f) => ({
    _key: neuerKey(),
    katKey: f.kategorie ? nameToKey.get(f.kategorie) ?? null : null,
    frage: f.frage,
    antwort: f.antwort,
  }));
  return { kats, faqs };
}

export function VorlageEditor({ vorlage }: { vorlage: LageVorlage }) {
  const router = useRouter();
  const initial = vorlageZuState(vorlage);
  const [name, setName] = useState(vorlage.name);
  const [kats, setKats] = useState<Kat[]>(initial.kats);
  const [faqs, setFaqs] = useState<FAQ[]>(initial.faqs);
  const [pending, setPending] = useState(false);

  function kategorieAdd() {
    setKats((alt) => [...alt, { _key: neuerKey(), name: "" }]);
  }

  function kategorieRemove(key: string) {
    setKats((alt) => alt.filter((k) => k._key !== key));
    setFaqs((alt) =>
      alt.map((f) => (f.katKey === key ? { ...f, katKey: null } : f)),
    );
  }

  function kategorieRename(key: string, neuerName: string) {
    setKats((alt) =>
      alt.map((k) => (k._key === key ? { ...k, name: neuerName } : k)),
    );
  }

  function kategorieMove(key: string, richtung: -1 | 1) {
    setKats((alt) => {
      const idx = alt.findIndex((k) => k._key === key);
      if (idx < 0) return alt;
      const ziel = idx + richtung;
      if (ziel < 0 || ziel >= alt.length) return alt;
      const next = [...alt];
      [next[idx], next[ziel]] = [next[ziel], next[idx]];
      return next;
    });
  }

  function faqAdd() {
    setFaqs((alt) => [
      ...alt,
      { _key: neuerKey(), katKey: null, frage: "", antwort: "" },
    ]);
  }

  function faqRemove(key: string) {
    setFaqs((alt) => alt.filter((f) => f._key !== key));
  }

  function faqUpdate(key: string, patch: Partial<FAQ>) {
    setFaqs((alt) =>
      alt.map((f) => (f._key === key ? { ...f, ...patch } : f)),
    );
  }

  async function speichern() {
    setPending(true);
    const keyToName = new Map(kats.map((k) => [k._key, k.name.trim()]));
    const payload = {
      name,
      kategorien: kats.map((k, i) => ({ name: k.name, reihenfolge: i })),
      standard_faqs: faqs.map((f) => ({
        kategorie: f.katKey ? keyToName.get(f.katKey) ?? null : null,
        frage: f.frage,
        antwort: f.antwort,
      })),
    };

    const result = await aktualisiereVorlage(vorlage.id, payload);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      router.push("/einstellungen/vorlagen");
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border bg-white p-5 space-y-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="vorlage-name">Name der Vorlage</Label>
          <Input
            id="vorlage-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Hochwasser"
          />
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Kategorien</h2>
          <Button size="sm" variant="outline" onClick={kategorieAdd}>
            <Plus className="w-4 h-4 mr-1" />
            Kategorie
          </Button>
        </div>
        {kats.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Noch keine Kategorien angelegt.
          </p>
        )}
        <ul className="space-y-2">
          {kats.map((k, idx) => (
            <li
              key={k._key}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <span className="text-xs text-muted-foreground w-6 text-center">
                {idx + 1}
              </span>
              <Input
                value={k.name}
                onChange={(e) => kategorieRename(k._key, e.target.value)}
                placeholder="Kategoriename"
                className="flex-1 h-8"
              />
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => kategorieMove(k._key, -1)}
                disabled={idx === 0}
                aria-label="Nach oben"
                title="Nach oben"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => kategorieMove(k._key, 1)}
                disabled={idx === kats.length - 1}
                aria-label="Nach unten"
                title="Nach unten"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => kategorieRemove(k._key)}
                aria-label="Entfernen"
                title="Entfernen"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Standard-FAQs</h2>
          <Button size="sm" variant="outline" onClick={faqAdd}>
            <Plus className="w-4 h-4 mr-1" />
            FAQ
          </Button>
        </div>
        {faqs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Noch keine Standard-FAQs hinterlegt.
          </p>
        )}
        <ul className="space-y-3">
          {faqs.map((f) => (
            <li key={f._key} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={f.katKey ?? ""}
                  onChange={(e) =>
                    faqUpdate(f._key, {
                      katKey: e.target.value || null,
                    })
                  }
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm flex-1"
                >
                  <option value="">— ohne Kategorie —</option>
                  {kats
                    .filter((k) => k.name.trim().length > 0)
                    .map((k) => (
                      <option key={k._key} value={k._key}>
                        {k.name}
                      </option>
                    ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => faqRemove(f._key)}
                  aria-label="Entfernen"
                  title="Entfernen"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <Input
                value={f.frage}
                onChange={(e) => faqUpdate(f._key, { frage: e.target.value })}
                placeholder="Frage"
                className="h-9"
              />
              <Textarea
                value={f.antwort}
                onChange={(e) =>
                  faqUpdate(f._key, { antwort: e.target.value })
                }
                placeholder="Antwort"
                rows={3}
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-white/95 backdrop-blur border-t flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push("/einstellungen/vorlagen")}
          disabled={pending}
        >
          Abbrechen
        </Button>
        <Button onClick={speichern} disabled={pending || !name.trim()}>
          {pending ? "Speichere …" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
