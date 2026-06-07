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
  experiments: "text-emerald-700",
  home: "text-blue-800",
  notes: "text-stone-700",
  papers: "text-indigo-700",
  projects: "text-sky-800",
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
          "relative shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
          active
            ? "border-primary/25 bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(34,69,120,0.14)]"
            : "border-border/70 bg-white/76 text-muted-foreground hover:border-primary/20 hover:bg-white hover:text-primary",
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
        "group relative flex min-h-10 items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 py-2 text-sm transition",
        active
          ? "border-primary/18 bg-[#eef3fb] font-semibold text-sidebar-foreground shadow-[0_8px_20px_rgba(34,69,120,0.07)]"
          : "border-transparent text-muted-foreground hover:border-sidebar-border/80 hover:bg-white/72 hover:text-sidebar-foreground",
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
              ? "border-primary/18 bg-white/72 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
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
