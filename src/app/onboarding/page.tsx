import { redirect } from "next/navigation";
import {
  getOnboardingStatus,
  onboardingPfad,
  requireProfile,
} from "@/lib/auth";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingWizardPage() {
  const profile = await requireProfile();
  const status = await getOnboardingStatus();
  // Nur wer wirklich gründen darf, sieht den Wizard. Alle anderen wandern auf
  // ihre passende Station (Mitglied -> App, gesperrt -> Gesperrt-Screen).
  if (status !== "kann_gruenden") redirect(onboardingPfad(status));

  const eigeneDomain = profile.email.split("@")[1] ?? "";

  return (
    <AuthSplitLayout inhaltsbreite="max-w-md">
      <OnboardingWizard eigeneDomain={eigeneDomain} />
    </AuthSplitLayout>
  );
}
