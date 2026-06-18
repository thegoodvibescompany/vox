import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Workspace-Root explizit setzen — das übergeordnete OneDrive-Verzeichnis
  // enthält ein anderes package-lock.json, das Next sonst fälschlich als Root nimmt.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Zugriff auf den Dev-Server über einen anderen Host als localhost (z. B.
  // einen VPN-/Mesh-Hostnamen) hier freischalten, sonst blockiert Next die
  // HMR-Verbindung. Beispiel:
  //   allowedDevOrigins: ["dev.example.internal"],
  // Statische Security-Header für alle Antworten (auch statische Assets). Die
  // Content-Security-Policy wird dagegen pro Request mit einer Nonce in der
  // Middleware gesetzt (src/lib/csp.ts) und steht daher bewusst nicht hier.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // App rendert nichts, das eingebettet werden soll -> Clickjacking aus.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Browser-Features, die VOX nicht nutzt, explizit abschalten.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // 180 Tage HSTS; wirkt nur über HTTPS (Produktion), lokal harmlos.
          {
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
