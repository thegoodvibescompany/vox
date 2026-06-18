"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Aktualisiert die aktuelle Route periodisch serverseitig (`router.refresh()`),
 * damit Server-Components frische Daten holen.
 *
 * Ersetzt die frühere Realtime-Lösung (Supabase-WebSocket direkt aus dem
 * Browser). Seit dem SSR-only-Umbau spricht der Browser ausschließlich mit dem
 * Next.js-Server; das Supabase-Gateway (Kong) muss dadurch nicht mehr
 * öffentlich erreichbar sein.
 *
 * Ein modul-globaler Koordinator sorgt dafür, dass beliebig viele gleichzeitig
 * gemountete Aufrufer nur EINEN Timer und EIN `refresh()` pro Intervall
 * erzeugen. Das Polling pausiert, solange der Tab im Hintergrund ist, und
 * aktualisiert sofort, sobald er wieder sichtbar wird.
 */

const DEFAULT_INTERVAL_MS = 15_000;

const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;
let intervalMs = DEFAULT_INTERVAL_MS;

function tick() {
  if (typeof document !== "undefined" && document.hidden) return;
  // Alle Aufrufer lösen denselben App-Router neu; einer genügt pro Tick.
  const erster = subscribers.values().next().value;
  erster?.();
}

function starteKoordinator() {
  if (timer !== null) return;
  timer = setInterval(tick, intervalMs);
  if (typeof document !== "undefined" && visibilityHandler === null) {
    visibilityHandler = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  }
}

function stoppeKoordinator() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (visibilityHandler !== null && typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
}

/**
 * @param ms Polling-Intervall in Millisekunden. Wirksam ist der Wert des ersten
 *   aktiven Aufrufers (alle laufenden Aufrufer teilen sich einen Timer).
 */
export function useAutoRefresh(ms: number = DEFAULT_INTERVAL_MS): void {
  const router = useRouter();

  useEffect(() => {
    intervalMs = ms;
    const refresh = () => router.refresh();
    subscribers.add(refresh);
    starteKoordinator();
    return () => {
      subscribers.delete(refresh);
      if (subscribers.size === 0) stoppeKoordinator();
    };
  }, [router, ms]);
}
