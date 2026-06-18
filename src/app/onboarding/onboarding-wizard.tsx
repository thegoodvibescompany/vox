"use client";

import { useState } from "react";
import { AnimierterHaken } from "@/components/animierter-haken";
import { Button } from "@/components/ui/button";
import { WizardForm } from "./wizard-form";

/**
 * Zweistufiges Onboarding: Schritt 1 belohnt die verifizierte Domain (Haken,
 * der sich zeichnet, + die Domain prominent daneben), Schritt 2 ist das
 * eigentliche Formular. Reiner Client-Schritt-Wechsel, kein zusätzlicher
 * Server-Roundtrip.
 */
export function OnboardingWizard({ eigeneDomain }: { eigeneDomain: string }) {
  const [schritt, setSchritt] = useState<"verifiziert" | "formular">(
    "verifiziert",
  );

  if (schritt === "verifiziert") {
    return (
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-4">
          <AnimierterHaken className="size-14 shrink-0" />
          <div className="text-left">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
              Domain verifiziert
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
              @{eigeneDomain}
            </p>
          </div>
        </div>
        <Button onClick={() => setSchritt("formular")} className="mt-8 h-11">
          Behörde einrichten
        </Button>
      </div>
    );
  }

  return (
    <div className="duration-300 animate-in fade-in slide-in-from-right-2">
      <h1 className="mb-6 text-xl font-semibold text-stone-900">
        Richte deine Behörde ein
      </h1>
      <WizardForm eigeneDomain={eigeneDomain} />
    </div>
  );
}
