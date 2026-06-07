"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  icon: Icon,
  compact = false,
}: {
  href: string;
  label: string;
  icon?: LucideIcon;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  if (compact) {
    return (
      <Link
        href={href}
        className={cn(
          "rounded-md border px-2 py-1 text-xs transition",
          active
            ? "border-[#1f3d33] bg-[#1f3d33] text-white"
            : "bg-white text-muted-foreground hover:border-[#b9c9c0] hover:text-[#1f3d33]",
        )}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-[#1f3d33] font-medium text-white shadow-sm hover:bg-[#1f3d33] hover:text-white"
          : "text-muted-foreground hover:bg-[#eef4ef] hover:text-[#1f3d33]",
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {label}
    </Link>
  );
}
