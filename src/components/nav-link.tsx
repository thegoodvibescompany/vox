"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-2 text-sm rounded-md transition-colors",
        active
          ? "bg-stone-900 text-stone-50"
          : "text-stone-700 hover:bg-stone-200",
      )}
    >
      {children}
    </Link>
  );
}
