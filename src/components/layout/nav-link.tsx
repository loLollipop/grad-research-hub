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
  admin: "text-amber-700",
  ai: "text-violet-700",
  data: "text-cyan-700",
  experiments: "text-teal-700",
  home: "text-slate-700",
  notes: "text-indigo-700",
  papers: "text-blue-700",
  projects: "text-emerald-700",
  settings: "text-slate-700",
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
          "relative rounded-md border px-2 py-1 text-xs transition",
          active
            ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
            : "bg-white text-muted-foreground hover:border-primary/20 hover:text-primary",
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
        "group relative flex min-h-10 items-center gap-2.5 overflow-hidden rounded-md border border-transparent px-2.5 py-2 text-sm transition",
        active
          ? "border-primary/15 bg-white font-medium text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-white/80 hover:text-foreground",
      )}
    >
      {active ? (
        <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-primary" />
      ) : null}
      {Icon ? (
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border transition",
            active
              ? "border-primary/15 bg-primary/10 text-primary"
              : "border-transparent bg-sidebar-accent/55 group-hover:bg-sidebar-accent",
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
