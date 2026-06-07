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
  admin: "text-amber-300",
  ai: "text-violet-300",
  data: "text-cyan-300",
  experiments: "text-teal-300",
  home: "text-slate-200",
  notes: "text-indigo-300",
  papers: "text-blue-300",
  projects: "text-emerald-300",
  settings: "text-slate-200",
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
          "relative rounded-lg border px-2.5 py-1.5 text-xs transition",
          active
            ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
            : "bg-white/80 text-muted-foreground hover:border-primary/20 hover:text-primary",
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
          ? "border-white/12 bg-white/[0.105] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_22px_rgba(0,0,0,0.18)]"
          : "border-transparent text-sidebar-foreground/62 hover:border-white/8 hover:bg-white/[0.06] hover:text-white",
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
              ? "border-sidebar-primary/25 bg-sidebar-primary/14 text-sidebar-primary"
              : "border-white/6 bg-white/[0.045] group-hover:bg-white/[0.075]",
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
