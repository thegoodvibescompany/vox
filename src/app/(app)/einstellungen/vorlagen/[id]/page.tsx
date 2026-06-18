import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecht } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { VorlageEditor } from "./vorlage-editor";
import type { LageVorlage } from "@/lib/types";

export default async function VorlageBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRecht("vorlage.verwalten");
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("lage_vorlage")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const vorlage = data as LageVorlage;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div>
        <Link
          href="/einstellungen/vorlagen"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Vorlagen
        </Link>
        <h1 className="text-2xl font-semibold mt-1">
          Vorlage bearbeiten: {vorlage.name}
        </h1>
      </div>

      <VorlageEditor vorlage={vorlage} />
    </main>
  );
}
