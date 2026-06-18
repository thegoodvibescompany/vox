import { formatDeDatumZeit } from "@/lib/lage-utils";
import type { FachstellenNachricht } from "@/lib/types";

// Ausklappbarer Schriftwechsel auf der Bürgeranfragen-Karte (Leitung).
// Zeigt die archivierten früheren Runden (Antworten + Rückfragen). Die
// Original-Frage und die aktuelle Antwort stehen separat auf der Karte.
export function FachstellenVerlauf({
  nachrichten,
}: {
  nachrichten: FachstellenNachricht[];
}) {
  if (nachrichten.length === 0) return null;
  return (
    <details className="mt-3 rounded-md border bg-stone-50/60">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-stone-600 hover:text-stone-800">
        Bisheriger Schriftwechsel ({nachrichten.length})
      </summary>
      <ol className="space-y-2 px-3 pb-3">
        {nachrichten.map((n) => {
          const istFrage = n.richtung === "frage";
          const titel = istFrage
            ? "Rückfrage der Leitung"
            : "Antwort der Fachstelle";
          // Person: bei der Leitung der Name, bei der Fachstelle Name · E-Mail.
          const personTeile = istFrage
            ? [n.autor_name]
            : [n.autor_name, n.autor_email];
          const person = personTeile.filter(Boolean).join(" · ");
          return (
            <li
              key={n.id}
              className="rounded-md border border-stone-200 bg-white p-3"
            >
              <div className="text-xs font-medium text-stone-700">{titel}</div>
              <div className="text-xs text-stone-500 mb-2">
                {[person, formatDeDatumZeit(n.created_at)]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-900">
                {n.text}
              </div>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
