import { CheckCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDeDatumZeit } from "@/lib/lage-utils";
import { StatusIcon } from "@/components/status-icon";
import { AntwortForm } from "./antwort-form";

type FrageRow = {
  id: string;
  frage_text: string;
  fachstelle_email: string | null;
  lage_name: string;
  bereits_beantwortet: boolean;
};

type DialogRow = {
  richtung: "frage" | "antwort";
  inhalt: string;
  wann: string;
  autor_name: string | null;
  autor_email: string | null;
};

export default async function AntwortenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const [frageRes, dialogRes] = await Promise.all([
    supabase.rpc("load_buergerfrage_by_token", { p_token: token }),
    supabase.rpc("load_fachstellen_dialog", { p_token: token }),
  ]);

  if (frageRes.error) {
    return (
      <Hinweis icon={TriangleAlert} title="Fehler" body={frageRes.error.message} />
    );
  }
  const frage = (frageRes.data as FrageRow[] | null)?.[0] ?? null;
  if (!frage) {
    return (
      <Hinweis
        icon={TriangleAlert}
        title="Link ungültig"
        body="Dieser Antwort-Link ist nicht mehr gültig oder abgelaufen. Bitte fordern Sie einen neuen Link beim Bürgertelefon an."
      />
    );
  }
  if (frage.bereits_beantwortet) {
    return (
      <Hinweis
        icon={CheckCheck}
        title="Schon beantwortet"
        body="Diese Bürgerfrage wurde bereits beantwortet — hier ist nichts weiter zu tun. Möchten Sie etwas ergänzen, wenden Sie sich bitte an das Bürgertelefon."
      />
    );
  }

  if (dialogRes.error) {
    return (
      <Hinweis
        icon={TriangleAlert}
        title="Fehler"
        body="Der Schriftwechsel konnte nicht geladen werden. Bitte den Link erneut aufrufen."
      />
    );
  }

  // Der Dialog enthält chronologisch: Original-Frage, frühere Antwort(en),
  // Rückfrage(n). Der letzte Eintrag ist die aktuell zu beantwortende Frage,
  // alles davor ist der bisherige Schriftwechsel.
  const dialog = (dialogRes.data as DialogRow[] | null) ?? [];
  const aktuelleFrage = dialog.length > 0 ? dialog[dialog.length - 1] : null;
  const verlauf = dialog.slice(0, -1);
  const aktuellerText = aktuelleFrage?.inhalt ?? frage.frage_text;
  const hatVerlauf = verlauf.length > 0;

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <header className="mb-8">
          <p className="text-sm uppercase tracking-wide text-stone-600">
            Bürgertelefon
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Bürgerfrage zur aktuellen Lage: {frage.lage_name}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Bitte beantworten Sie die untenstehende Frage. Ihre Antwort wird
            durch die Leitung des Bürgertelefons geprüft und dann an
            Bürger:innen weitergegeben.
          </p>
        </header>

        {hatVerlauf && (
          <section className="mb-6">
            <h2 className="text-xs font-medium uppercase tracking-wide text-stone-600 mb-3">
              Bisheriger Schriftwechsel
            </h2>
            <ol className="space-y-3">
              {verlauf.map((m, i) => {
                const istFrage = m.richtung === "frage";
                const person = (
                  istFrage ? [m.autor_name] : [m.autor_name, m.autor_email]
                )
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={i}
                    className="rounded-lg border border-stone-200 bg-stone-100 p-4"
                  >
                    <div className="text-xs font-medium text-stone-700">
                      {istFrage ? "Bürgertelefon" : "Ihre Fachstelle"}
                    </div>
                    <div className="text-xs text-stone-500">
                      {[person, formatDeDatumZeit(m.wann)]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap leading-relaxed text-stone-900">
                      {m.inhalt}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section className="rounded-lg border border-stone-300 bg-stone-100 p-5 mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-stone-600">
            {hatVerlauf ? "Aktuelle Rückfrage" : "Frage des Bürgertelefons"}
          </h2>
          {aktuelleFrage?.autor_name && (
            <p className="mt-1 text-xs text-stone-500">
              von {aktuelleFrage.autor_name}
            </p>
          )}
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-stone-900">
            {aktuellerText}
          </p>
        </section>

        <AntwortForm token={token} />
      </div>
    </main>
  );
}

function Hinweis({
  icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <main className="min-h-screen bg-stone-50">
      <div className="container mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center">
        <StatusIcon icon={icon} variante="neutral" />
        <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
        <p className="mt-3 text-sm text-stone-600">{body}</p>
      </div>
    </main>
  );
}
