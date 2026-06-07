"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  ClipboardList,
  FlaskConical,
  Home,
  LineChart,
  NotebookTabs,
  ScrollText,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";

const icons = {
  admin: ClipboardList,
  ai: Bot,
  data: LineChart,
  experiments: FlaskConical,
  home: Home,
  notes: NotebookTabs,
  papers: ScrollText,
  projects: BarChart3,
  settings: Settings,
} as const;

export type NavIcon = keyof typeof icons;

export function NavLink({
  href,
  label,
  icon,
  compact = false,
}: {
  href: string;
  label: string;
  icon?: NavIcon;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active =
    href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const Icon = icon ? icons[icon] : null;

  if (compact) {
    return (
      <Link
        href={href}
        prefetch={true}
        className={cn(
          "relative rounded-md border px-2 py-1 text-xs transition",
          active
            ? "border-[#1f3d33] bg-[#1f3d33] text-white"
            : "bg-white text-muted-foreground hover:border-[#b9c9c0] hover:text-[#1f3d33]",
        )}
      >
        {label}
        <NavPendingMark compact />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      prefetch={true}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-[#1f3d33] font-medium text-white shadow-sm hover:bg-[#1f3d33] hover:text-white"
          : "text-muted-foreground hover:bg-[#eef4ef] hover:text-[#1f3d33]",
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {label}
      <NavPendingMark />
    </Link>
  );
}

function NavPendingMark({ compact = false }: { compact?: boolean }) {
  const { pending } = useLinkStatus();

  if (!pending) {
    return null;
  }

  if (compact) {
    return (
      <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-current opacity-70" />
    );
  }

  return (
    <span className="ml-auto size-1.5 animate-pulse rounded-full bg-current opacity-75" />
  );
}
