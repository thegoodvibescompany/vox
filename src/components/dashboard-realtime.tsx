"use client";

import { useAutoRefresh } from "@/lib/use-auto-refresh";

/**
 * Reine Client-Hülle, die das Dashboard (Server Component) per Polling
 * regelmäßig neu lädt, damit aktualisierte Bürgerfragen sichtbar werden.
 */
export function DashboardRealtime() {
  useAutoRefresh();
  return null;
}
