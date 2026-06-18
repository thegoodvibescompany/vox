import { Badge } from "@/components/ui/badge";
import type { FrageStatus } from "@/lib/types";

const TEL_LABEL: Record<string, { text: string; color: string }> = {
  neu: { text: "Neu", color: "bg-red-100 text-red-900 border-red-200" },
  bei_fachstelle: { text: "Bei Fachstelle", color: "bg-amber-100 text-amber-900 border-amber-200" },
  freigegeben: { text: "Beantwortet", color: "bg-emerald-100 text-emerald-900 border-emerald-200" },
};

const LTG_LABEL: Record<string, { text: string; color: string }> = {
  neu: { text: "Neu", color: "bg-red-100 text-red-900 border-red-200" },
  bei_fachstelle: { text: "Bei Fachstelle", color: "bg-amber-100 text-amber-900 border-amber-200" },
  antwort_eingegangen: { text: "Antwort eingegangen", color: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  freigegeben: { text: "Freigegeben", color: "bg-emerald-100 text-emerald-900 border-emerald-200" },
};

export function FrageStatusBadge({
  status,
  darfFreigeben,
}: {
  status: FrageStatus | string;
  darfFreigeben: boolean;
}) {
  const map = darfFreigeben ? LTG_LABEL : TEL_LABEL;
  const entry = map[status] ?? { text: status, color: "bg-stone-100 text-stone-900 border-stone-200" };
  return (
    <Badge variant="outline" className={`${entry.color} border`}>
      {entry.text}
    </Badge>
  );
}

export function FreigabeNoetigBadge() {
  return (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
      Freigabe nötig
    </Badge>
  );
}
