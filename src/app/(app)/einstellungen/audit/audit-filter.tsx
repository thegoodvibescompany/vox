"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Option = { value: string; label: string };

export function AuditFilter({
  tabelleOptionen,
  opOptionen,
  currentTabelle,
  currentOp,
}: {
  tabelleOptionen: Option[];
  opOptionen: Option[];
  currentTabelle: string;
  currentOp: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `/einstellungen/audit?${qs}` : "/einstellungen/audit");
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <select
        value={currentTabelle}
        onChange={(e) => updateParam("tabelle", e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {tabelleOptionen.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={currentOp}
        onChange={(e) => updateParam("op", e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {opOptionen.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {(currentTabelle || currentOp) && (
        <button
          type="button"
          onClick={() => router.push("/einstellungen/audit")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm hover:bg-stone-50"
        >
          Filter zurücksetzen
        </button>
      )}
    </div>
  );
}
