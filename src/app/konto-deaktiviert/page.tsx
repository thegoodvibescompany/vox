import { UserX } from "lucide-react";
import { AuthSplitLayout } from "@/components/auth-split-layout";
import { StatusIcon } from "@/components/status-icon";

// Dynamisch rendern, damit die pro Request gesetzte CSP-Nonce auf die
// Next.js-Skripte angewendet wird (sonst würde strict-dynamic sie auf der
// statisch vorgerenderten Seite blockieren).
export const dynamic = "force-dynamic";

export default function KontoDeaktiviertPage() {
  return (
    <AuthSplitLayout>
      <div className="flex flex-col items-center text-center">
        <StatusIcon icon={UserX} variante="neutral" />
        <h1 className="text-lg font-semibold text-stone-900">
          Konto deaktiviert
        </h1>
        <p className="mt-3 text-sm text-stone-500">
          Dein Konto ist aktuell deaktiviert. Bitte wende dich an die Verwaltung,
          um es wieder freizuschalten.
        </p>
        <form action="/auth/logout" method="post" className="mt-8">
          <button
            type="submit"
            className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Abmelden
          </button>
        </form>
      </div>
    </AuthSplitLayout>
  );
}
