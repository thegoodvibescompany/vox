"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AktuellesProfil } from "@/lib/types";

export function UserMenu({ profile }: { profile: AktuellesProfil }) {
  const initials = (profile.name || profile.email)
    .split(/[\s.@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400">
        <span className="inline-flex w-7 h-7 rounded-full bg-stone-200 text-stone-800 items-center justify-center text-xs font-medium">
          {initials || "?"}
        </span>
        <span className="hidden sm:inline">
          {profile.name || profile.email}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {profile.name || profile.email}
              </span>
              <span className="text-xs text-muted-foreground">
                {profile.rolle_name ?? "Keine Rolle"}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/hilfe" />}
          className="cursor-pointer px-2 py-1.5"
        >
          Hilfe — Wie funktioniert VOX?
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/auth/logout" method="post" className="px-1 py-1">
          <button
            type="submit"
            className="w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-stone-100"
          >
            Abmelden
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
