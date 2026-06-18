"use client";

import { Mail } from "lucide-react";
import { StatusIcon } from "@/components/status-icon";
import { ZurueckKnopf } from "@/components/zurueck-knopf";

/**
 * Erfolgs-Ansicht nach dem Versand eines Magic-/Anmelde-Links: ein Brief, der
 * hereinfliegt, plus Hinweis aufs Postfach und ein Weg zurück. Ersetzt das
 * Eingabeformular, statt nur einen Statustext darunter zu zeigen.
 */
export function MagicLinkBestaetigung({
  email,
  onZurueck,
  zurueckLabel = "Zurück zur Anmeldung",
}: {
  email?: string;
  onZurueck: () => void;
  zurueckLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <StatusIcon icon={Mail} variante="erfolg" />

      <h2 className="text-lg font-semibold text-stone-900">
        Prüfe dein Postfach
      </h2>
      <p className="mt-2 text-sm text-stone-500">
        {email ? (
          <>
            Wir haben einen Anmeldelink an{" "}
            <span className="font-medium text-stone-700">{email}</span>{" "}
            geschickt. Öffne ihn auf diesem Gerät, um dich anzumelden.
          </>
        ) : (
          "Wir haben dir einen Anmeldelink geschickt. Öffne ihn auf diesem Gerät, um dich anzumelden."
        )}
      </p>

      <div className="mt-8">
        <ZurueckKnopf onClick={onZurueck} label={zurueckLabel} />
      </div>
    </div>
  );
}
