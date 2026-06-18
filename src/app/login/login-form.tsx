"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MagicLinkBestaetigung } from "@/components/magic-link-bestaetigung";
import { FormFehler } from "@/components/form-fehler";
import { signInWithMagicLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<
    LoginState | undefined,
    FormData
  >(signInWithMagicLink, undefined);
  // "Zurück" merkt sich den State, bei dem es geklickt wurde. So bleibt das
  // Formular sichtbar, bis ein NEUER Versand erfolgt (= neues State-Objekt aus
  // useActionState) — abgeleitet statt im Effect gespiegelt.
  const [verworfen, setVerworfen] = useState<LoginState | undefined>();

  if (state?.ok && state !== verworfen) {
    return (
      <MagicLinkBestaetigung
        email={state.email}
        onZurueck={() => setVerworfen(state)}
      />
    );
  }

  return (
    <>
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-stone-600">
            E-Mail-Adresse
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="name@ihre-behoerde.de"
            className="h-11"
          />
        </div>

        <Button type="submit" disabled={pending} className="h-11 w-full">
          {pending ? "Sende Link …" : "Magic Link senden"}
        </Button>

        {state && !state.ok && <FormFehler>{state.message}</FormFehler>}
      </form>
    </>
  );
}
