"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { erstelleVorlage } from "../actions";

export function NeueVorlageButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function anlegen() {
    setPending(true);
    try {
      const r = await erstelleVorlage();
      if (r.ok && r.id) {
        router.push(`/einstellungen/vorlagen/${r.id}`);
      } else {
        toast.error(r.message);
        setPending(false);
      }
    } catch {
      toast.error("Vorlage konnte nicht angelegt werden.");
      setPending(false);
    }
  }

  return (
    <Button size="sm" onClick={anlegen} disabled={pending}>
      <Plus className="w-4 h-4 mr-1" />
      {pending ? "Lege an …" : "Neue Vorlage"}
    </Button>
  );
}
