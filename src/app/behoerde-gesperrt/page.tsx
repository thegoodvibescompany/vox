import Link from "next/link";
import { Ban } from "lucide-react";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { StatusIcon } from "@/components/status-icon";

export default async function BehoerdeGesperrtPage() {
  const profile = await requireProfile();

  // Nur anzeigen, wenn die Behörde wirklich gesperrt ist — sonst zurück in die App.
  const supabase = await createClient();
  const { data: behoerde } = await supabase
    .from("behoerde")
    .select("status")
    .eq("id", profile.behoerde_id as string)
    .maybeSingle();
  if (behoerde?.status !== "gesperrt") {
    redirect("/");
  }

  return (
    <AuthSplitLayout>
      <div className="flex flex-col items-center text-center">
        <StatusIcon icon={Ban} variante="neutral" />
        <h1 className="text-lg font-semibold text-stone-900">
          Behörde gesperrt
        </h1>
        <p className="mt-3 text-sm text-stone-500">
          Der Zugang deiner Behörde zu VOX wurde vom Plattform-Betreiber
          gesperrt. Solange die Sperre besteht, ist die Anwendung für alle
          Mitglieder nicht nutzbar. Bitte wende dich an den Betreiber, um die
          Sperre klären zu lassen.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 text-sm">
          {profile.ist_plattform_admin && (
            <Link
              href="/einstellungen/behoerden"
              className="text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
            >
              Zur Behördenübersicht
            </Link>
          )}
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
            >
              Abmelden
            </button>
          </form>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
