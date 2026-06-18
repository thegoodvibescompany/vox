import { requireProfile } from "@/lib/auth";
import { HilfeClient } from "./hilfe-client";

// Die Hilfe ist bewusst auch ohne aktive Lage erreichbar — gerade dann
// (z. B. vor dem ersten Einsatz) wird sie gelesen.
export default async function HilfePage() {
  const profile = await requireProfile();

  return (
    <HilfeClient
      permissions={profile.permissions}
      istPlattformAdmin={profile.ist_plattform_admin}
      rolleName={profile.rolle_name}
    />
  );
}
