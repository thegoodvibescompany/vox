import { MailX } from "lucide-react";
import { redirect } from "next/navigation";
import {
  getOnboardingStatus,
  onboardingPfad,
  requireProfile,
} from "@/lib/auth";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { StatusIcon } from "@/components/status-icon";

export default async function OnboardingGesperrtPage() {
  const profile = await requireProfile();
  const status = await getOnboardingStatus();
  if (status !== "gesperrt") redirect(onboardingPfad(status));

  return (
    <AuthSplitLayout>
      <div className="flex flex-col items-center text-center">
        <StatusIcon icon={MailX} variante="neutral" />
        <h1 className="text-lg font-semibold text-stone-900">
          Keine dienstliche E-Mail-Adresse
        </h1>
        <p className="mt-3 text-sm text-stone-500">
          Mit der Adresse{" "}
          <span className="font-medium text-stone-700">{profile.email}</span>{" "}
          lässt sich keine Behörde einrichten. VOX ist für Behörden gedacht und
          setzt eine dienstliche E-Mail-Domain voraus. Private Anbieter wie gmx,
          web.de oder gmail sind nicht zugelassen.
        </p>
        <form action="/auth/logout" method="post" className="mt-8">
          <button
            type="submit"
            className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Mit anderer Adresse anmelden
          </button>
        </form>
      </div>
    </AuthSplitLayout>
  );
}
