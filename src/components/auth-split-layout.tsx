import type { ReactNode } from "react";

/**
 * Split-Screen-Rahmen für alle Auth-/Onboarding-Seiten: dunkle VOX-Branding-
 * Hälfte links (ab `lg` sichtbar), helle Inhalts-Hälfte rechts. Auf schmalen
 * Viewports ist die Branding-Hälfte ausgeblendet; stattdessen erscheint oben
 * im Inhalt ein VOX-Wortzeichen.
 *
 * Einzige Quelle für dieses Layout — Login, Onboarding und die
 * Status-Screens (gesperrt / Behörde gesperrt / Konto deaktiviert) nutzen es.
 */
export function AuthSplitLayout({
  label,
  inhaltsbreite = "max-w-sm",
  children,
}: {
  /** Optionaler Zusatz hinter „VOX" (z. B. ein Bereichsname). */
  label?: string;
  /** Tailwind-max-width-Klasse der Inhaltsspalte (Default `max-w-sm`). */
  inhaltsbreite?: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Branding-Hälfte — großes VOX auf atmosphärischem Grund */}
      <section className="relative hidden overflow-hidden bg-stone-950 lg:flex lg:items-center lg:justify-center">
        {/* weicher Lichtschein oben links */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(125% 85% at 28% 22%, rgba(255,255,255,0.10), transparent 58%)",
          }}
        />
        {/* feines technisches Raster, zum Rand hin ausgeblendet */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "52px 52px",
            WebkitMaskImage:
              "radial-gradient(circle at 32% 34%, black, transparent 78%)",
            maskImage:
              "radial-gradient(circle at 32% 34%, black, transparent 78%)",
          }}
        />
        <div className="relative text-center duration-700 animate-in fade-in slide-in-from-bottom-3">
          <span className="block select-none text-[8rem] font-semibold leading-none tracking-tighter text-white xl:text-[9.5rem]">
            VOX
          </span>
          {label && (
            <span className="mt-5 block text-sm font-medium uppercase tracking-[0.4em] text-stone-400">
              {label}
            </span>
          )}
        </div>
      </section>

      {/* Inhalts-Hälfte */}
      <section className="flex items-center justify-center bg-white px-6 py-12">
        <div
          className={`w-full ${inhaltsbreite} duration-700 animate-in fade-in slide-in-from-bottom-3`}
        >
          {/* Wortzeichen für schmale Viewports (links ist dort ausgeblendet) */}
          <span className="mb-10 block select-none text-3xl font-semibold tracking-tighter text-stone-900 lg:hidden">
            VOX
            {label && <span className="text-stone-400"> {label}</span>}
          </span>

          {children}
        </div>
      </section>
    </main>
  );
}
