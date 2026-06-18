"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormFehler } from "@/components/form-fehler";
import { richteBehoerdeEin, type WizardState } from "./actions";
import { BEHOERDEN_TYPEN } from "@/lib/types";

export function WizardForm({ eigeneDomain }: { eigeneDomain: string }) {
  const [state, action, pending] = useActionState<
    WizardState | undefined,
    FormData
  >(richteBehoerdeEin, undefined);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name" className="text-stone-600">
          Name der Behörde
        </Label>
        <Input
          id="name"
          name="name"
          required
          autoFocus
          placeholder="z. B. Stadt Musterstadt"
          className="h-11"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="typ" className="text-stone-600">
          Art der Behörde
        </Label>
        <select
          id="typ"
          name="typ"
          defaultValue=""
          className="h-11 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">Bitte wählen</option>
          {BEHOERDEN_TYPEN.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-stone-600">E-Mail-Domain</Label>
        <div className="flex h-11 items-center rounded-md border border-input bg-stone-50 px-3 text-sm">
          @{eigeneDomain}
        </div>
        <p className="text-xs text-stone-500">
          Diese Domain ist über deinen Anmelde-Link bestätigt und wird der
          Behörde fest zugeordnet. Nur Personen mit dieser Domain können später
          beitreten.
        </p>
      </div>

      <Button type="submit" disabled={pending} className="h-11 w-full">
        {pending ? "Behörde wird eingerichtet …" : "Behörde einrichten"}
      </Button>

      {state && !state.ok && <FormFehler>{state.message}</FormFehler>}
    </form>
  );
}
