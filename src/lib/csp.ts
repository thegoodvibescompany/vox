// Content-Security-Policy für VOX. Nonce-basiert: Pro Request wird eine
// zufällige Nonce erzeugt, die Next.js automatisch auf seine eigenen
// Inline-Bootstrap-Skripte anwendet (es liest sie aus dem
// Content-Security-Policy-Request-Header, den die Middleware setzt). Ein
// eingeschleustes Fremdskript kennt die pro Request neu gewürfelte Nonce nicht
// und wird vom Browser blockiert — anders als bei 'unsafe-inline'.

/**
 * Erzeugt eine zufällige, base64-kodierte Nonce. Verwendet die Web-Crypto-API
 * (crypto.getRandomValues + btoa), weil die Middleware in der Edge-Runtime
 * läuft, wo Node-APIs wie Buffer nicht verfügbar sind.
 */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Baut den Content-Security-Policy-Header-Wert für die gegebene Nonce.
 */
export function buildCsp(nonce: string): string {
  // Der Next.js-Dev-Server (Fast Refresh / HMR) führt Code per eval() aus, was
  // eine strikte Policy sonst blockiert. In Produktion bleibt eval verboten.
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = [
    // 'strict-dynamic': Skripte, die von einem vertrauenswürdigen (nonce-
    // getragenen) Next.js-Skript geladen werden, dürfen ihrerseits weitere
    // Chunks laden, ohne jede Quelle einzeln listen zu müssen. 'self' dient
    // nur als Fallback für ältere Browser, die 'strict-dynamic' nicht kennen.
    `'self'`,
    `'nonce-${nonce}'`,
    `'strict-dynamic'`,
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    // 'unsafe-inline' bei Styles ist unvermeidbar: Leaflet setzt Inline-Styles
    // (Kartenpositionen, Marker-Transforms) per JS, next/font ebenso. Bei
    // Styles ist das Risiko gering, da Styles keinen Code ausführen.
    `style-src 'self' 'unsafe-inline'`,
    // Karten-Tiles (OpenStreetMap) + Leaflet-Marker-Icons (cdnjs);
    // data:/blob: für dynamisch erzeugte Bilder und Marker.
    `img-src 'self' data: blob: https://tile.openstreetmap.org https://cdnjs.cloudflare.com`,
    // Geocoding-Anfragen an Nominatim laufen client-seitig per fetch.
    `connect-src 'self' https://nominatim.openstreetmap.org`,
    `font-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    // Ergänzt X-Frame-Options gegen Clickjacking (CSP3-Browser).
    `frame-ancestors 'none'`,
    // Erzwingt HTTPS für alle Subressourcen — nur in Produktion, da der
    // Dev-Server über HTTP läuft und das Upgrade ihn sonst lahmlegen würde.
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}
