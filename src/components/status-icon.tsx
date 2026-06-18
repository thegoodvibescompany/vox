import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusVariante = "erfolg" | "neutral";

/**
 * Icon-Badge für Auth-/Status-Screens.
 * - „erfolg" lässt das Icon hereinfliegen (dunkles Badge + Hof) — für positive
 *   Bestätigungen wie den versendeten Magic-Link.
 * - „neutral" blendet ein ruhiges, helles Badge ein — für Hinweis-/Sperr-Screens
 *   (kein Alarm-Rot, passt zum monochromen VOX-Look).
 *
 * Hook-frei → in Server- und Client-Komponenten verwendbar.
 */
export function StatusIcon({
  icon: Icon,
  variante = "neutral",
}: {
  icon: LucideIcon;
  variante?: StatusVariante;
}) {
  const erfolg = variante === "erfolg";
  return (
    <div className="relative mb-6 flex size-16 items-center justify-center">
      {erfolg && (
        <span
          aria-hidden
          className="animate-brief-hof absolute inset-0 rounded-2xl bg-stone-900/15"
        />
      )}
      <span
        className={cn(
          "relative flex size-16 items-center justify-center rounded-2xl",
          erfolg
            ? "animate-brief-flug bg-stone-900 text-white shadow-lg shadow-stone-900/20"
            : "bg-stone-100 text-stone-500 ring-1 ring-stone-200 duration-500 animate-in fade-in zoom-in-90",
        )}
      >
        <Icon className="size-7" strokeWidth={1.75} />
      </span>
    </div>
  );
}
