import Link from "next/link";
import { NavLink } from "./nav-link";
import { UserMenu } from "./user-menu";
import { NotizenTrigger } from "./notizen-trigger";
import { Posteingang, type PosteingangEintrag } from "./posteingang";
import { kannVerwalten } from "@/lib/types";
import type { AktuellesProfil, Notiz } from "@/lib/types";

export function SiteHeader({
  profile,
  notizen,
  posteingang,
  lageAktiv,
}: {
  profile: AktuellesProfil;
  notizen: Notiz[];
  posteingang: PosteingangEintrag[];
  lageAktiv: boolean;
}) {
  const darfVerwalten =
    kannVerwalten(profile.permissions) || profile.ist_plattform_admin;

  // Ohne aktive Lage: Telefonisten sehen nur Übersicht, Leitungen/Admins nur
  // Einstellungen (die inhaltlichen Tabs sind gegenstandslos).
  const showUebersicht = lageAktiv || !darfVerwalten;
  const showEinstellungen = darfVerwalten;

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 h-14 flex items-center gap-4">
        <Link
          href="/"
          className="font-semibold tracking-tight text-stone-900"
        >
          VOX
        </Link>
        <nav className="flex items-center gap-1 ml-4">
          {showUebersicht && <NavLink href="/">Übersicht</NavLink>}
          {/* Karte/Bürgeranfragen/FAQ ergeben nur Sinn, solange eine Lage läuft. */}
          {lageAktiv && (
            <>
              <NavLink href="/karte">Karte</NavLink>
              <NavLink href="/dashboard">Bürgeranfragen</NavLink>
              <NavLink href="/alle-faqs">FAQs</NavLink>
            </>
          )}
          {showEinstellungen && (
            <NavLink href="/einstellungen">Einstellungen</NavLink>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Posteingang eintraege={posteingang} />
          <NotizenTrigger notizen={notizen} />
          <UserMenu profile={profile} />
        </div>
      </div>
    </header>
  );
}
