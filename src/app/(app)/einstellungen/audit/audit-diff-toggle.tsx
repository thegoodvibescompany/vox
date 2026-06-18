"use client";

import { useState } from "react";

export function AuditDiffToggle({
  vorher,
  nachher,
}: {
  vorher: Record<string, unknown> | null;
  nachher: Record<string, unknown> | null;
}) {
  const [offen, setOffen] = useState(false);

  if (!vorher && !nachher) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="text-xs underline text-stone-700 hover:text-stone-900"
      >
        {offen ? "Schließen" : "Anzeigen"}
      </button>
      {offen && (
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          <pre className="rounded-md border bg-red-50 border-red-200 p-2 text-[11px] leading-tight overflow-x-auto max-w-[40ch] lg:max-w-none">
            <span className="block text-[10px] font-medium text-red-800 mb-1">
              Vorher
            </span>
            {vorher ? JSON.stringify(vorher, null, 2) : "—"}
          </pre>
          <pre className="rounded-md border bg-emerald-50 border-emerald-200 p-2 text-[11px] leading-tight overflow-x-auto max-w-[40ch] lg:max-w-none">
            <span className="block text-[10px] font-medium text-emerald-800 mb-1">
              Nachher
            </span>
            {nachher ? JSON.stringify(nachher, null, 2) : "—"}
          </pre>
        </div>
      )}
    </div>
  );
}
