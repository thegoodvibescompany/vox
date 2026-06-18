"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Plus, StickyNote, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDeDatumZeit } from "@/lib/lage-utils";
import {
  erstelleNotiz,
  aktualisiereNotiz,
  loescheNotiz,
} from "@/app/(app)/notizen-actions";
import type { Notiz } from "@/lib/types";

export function NotizenTrigger({ notizen }: { notizen: Notiz[] }) {
  const [offen, setOffen] = useState(false);

  // Schließen mit Escape
  useEffect(() => {
    if (!offen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOffen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offen]);

  // Body-Scroll sperren während offen
  useEffect(() => {
    if (!offen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [offen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        aria-label="Meine Notizen"
        title="Meine Notizen"
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-stone-100 text-stone-700"
      >
        <StickyNote className="w-5 h-5" />
        {notizen.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-stone-800 text-white text-[10px] font-medium flex items-center justify-center px-1">
            {notizen.length}
          </span>
        )}
      </button>

      {/* Backdrop + Panel */}
      <div
        className={`fixed inset-0 z-50 ${offen ? "" : "pointer-events-none"}`}
        aria-hidden={!offen}
      >
        <div
          onClick={() => setOffen(false)}
          className={`absolute inset-0 bg-black/30 transition-opacity ${
            offen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          role="dialog"
          aria-label="Meine Notizen"
          className={`absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl border-l flex flex-col transition-transform duration-200 ${
            offen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <NotizenPanel notizen={notizen} onClose={() => setOffen(false)} />
        </aside>
      </div>
    </>
  );
}

function NotizenPanel({
  notizen,
  onClose,
}: {
  notizen: Notiz[];
  onClose: () => void;
}) {
  const [neuOffen, setNeuOffen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Meine Notizen</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setNeuOffen(true)}
            aria-label="Neue Notiz"
            title="Neue Notiz"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-stone-100 text-stone-700"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            title="Schließen"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-stone-100 text-stone-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {neuOffen && (
          <NeueNotizFormular
            onFertig={() => setNeuOffen(false)}
            onAbbrechen={() => setNeuOffen(false)}
          />
        )}
        {notizen.length === 0 && !neuOffen ? (
          <p className="text-xs text-muted-foreground">
            Noch keine Notizen. Klick auf
            <span className="inline-flex items-center mx-1 align-middle">
              <Plus className="w-3 h-3" />
            </span>
            für die erste.
          </p>
        ) : (
          <ul className="space-y-3">
            {notizen.map((n) => (
              <li key={n.id}>
                <NotizKarte notiz={n} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function NeueNotizFormular({
  onFertig,
  onAbbrechen,
}: {
  onFertig: () => void;
  onAbbrechen: () => void;
}) {
  const [inhalt, setInhalt] = useState("");
  const [pending, start] = useTransition();

  function speichern() {
    const text = inhalt.trim();
    if (!text) return;
    const fd = new FormData();
    fd.set("inhalt", text);
    start(async () => {
      const r = await erstelleNotiz(fd);
      if (r.ok) {
        toast.success(r.message);
        setInhalt("");
        onFertig();
      } else toast.error(r.message);
    });
  }

  return (
    <div className="rounded-md border bg-stone-50 p-3 flex flex-col gap-2">
      <Textarea
        autoFocus
        value={inhalt}
        onChange={(e) => setInhalt(e.target.value)}
        rows={4}
        placeholder="Neue Notiz, z. B. Rückruf an Frau Müller …"
        className="text-sm bg-white"
      />
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onAbbrechen}
          disabled={pending}
        >
          Abbrechen
        </Button>
        <Button
          size="sm"
          onClick={speichern}
          disabled={pending || !inhalt.trim()}
        >
          {pending ? "…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}

function NotizKarte({ notiz }: { notiz: Notiz }) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [inhalt, setInhalt] = useState(notiz.inhalt);
  const [pending, start] = useTransition();

  function speichern() {
    const text = inhalt.trim();
    if (!text) return;
    const fd = new FormData();
    fd.set("id", notiz.id);
    fd.set("inhalt", text);
    start(async () => {
      const r = await aktualisiereNotiz(fd);
      if (r.ok) {
        toast.success(r.message);
        setBearbeiten(false);
      } else toast.error(r.message);
    });
  }

  function loeschen() {
    if (!confirm("Notiz wirklich löschen?")) return;
    const fd = new FormData();
    fd.set("id", notiz.id);
    start(async () => {
      const r = await loescheNotiz(fd);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });
  }

  function abbrechen() {
    setInhalt(notiz.inhalt);
    setBearbeiten(false);
  }

  return (
    <div className="rounded-md border bg-white p-3 text-sm">
      {bearbeiten ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={inhalt}
            onChange={(e) => setInhalt(e.target.value)}
            rows={4}
            className="text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={abbrechen}
              disabled={pending}
            >
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={speichern}
              disabled={pending || !inhalt.trim()}
            >
              {pending ? "…" : "Speichern"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap leading-relaxed">{notiz.inhalt}</p>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{formatDeDatumZeit(notiz.updated_at)}</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setBearbeiten(true)}
                aria-label="Bearbeiten"
                title="Bearbeiten"
                className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-stone-100"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={loeschen}
                aria-label="Löschen"
                title="Löschen"
                disabled={pending}
                className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-stone-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
