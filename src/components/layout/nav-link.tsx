"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ClipboardList,
  FlaskConical,
  Home,
  LineChart,
  NotebookPen,
  Settings,
  BookOpenText,
  FolderKanban,
} from "lucide-react";

import { cn } from "@/lib/utils";

const icons = {
  admin: ClipboardList,
  ai: Bot,
  data: LineChart,
  experiments: FlaskConical,
  home: Home,
  notes: NotebookPen,
  papers: BookOpenText,
  projects: FolderKanban,
  settings: Settings,
} as const;

const accents: Record<NavIcon, string> = {
  admin: "text-slate-500",
  ai: "text-slate-500",
  data: "text-slate-500",
  experiments: "text-slate-500",
  home: "text-slate-500",
  notes: "text-slate-500",
  papers: "text-slate-500",
  projects: "text-slate-500",
  settings: "text-slate-500",
};

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
  const accent = icon ? accents[icon] : "text-slate-700";

  if (compact) {
    return (
      <Link
        href={href}
        prefetch={true}
        className={cn(
          "relative shrink-0 rounded-full border px-3 py-1.5 text-xs transition",
          active
            ? "border-primary/25 bg-primary text-primary-foreground shadow-sm"
            : "border-border/70 bg-white/70 text-muted-foreground hover:border-primary/20 hover:text-primary",
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
        "group relative flex min-h-10 items-center gap-2.5 overflow-hidden rounded-lg border px-2.5 py-2 text-sm transition",
        active
          ? "border-primary/16 bg-white/86 font-medium text-sidebar-foreground shadow-[0_8px_18px_rgba(15,23,42,0.055)]"
          : "border-transparent text-muted-foreground hover:border-sidebar-border/80 hover:bg-white/64 hover:text-sidebar-foreground",
      )}
    >
      {active ? (
        <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-sidebar-primary" />
      ) : null}
      {Icon ? (
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border transition",
            active
              ? "border-primary/16 bg-primary/9 text-primary"
              : "border-sidebar-border/60 bg-white/56 group-hover:bg-white/78",
            !active && accent,
          )}
        >
          <Icon className="size-4" />
        </span>
      ) : null}
      <span className="truncate">{label}</span>
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
