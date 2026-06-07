import Link from "next/link";
import { CircleDot, Command, GraduationCap, Search, Sparkles, TimerReset } from "lucide-react";

import { quickCapture } from "@/lib/actions";
import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/", label: "首页", icon: "home" },
  { href: "/papers", label: "文献", icon: "papers" },
  { href: "/experiments", label: "实验", icon: "experiments" },
  { href: "/projects", label: "项目", icon: "projects" },
  { href: "/notes", label: "笔记", icon: "notes" },
  { href: "/data", label: "成果", icon: "data" },
  { href: "/admin", label: "事务", icon: "admin" },
] as const;

const utilityItems = [
  { href: "/ai", label: "AI", icon: "ai" },
  { href: "/settings", label: "设置", icon: "settings" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="workbench-surface min-h-screen text-foreground">
      <aside className="sidebar-panel fixed inset-y-0 left-0 hidden w-[17rem] border-r border-sidebar-border px-4 py-4 text-sidebar-foreground shadow-[10px_0_32px_rgba(15,23,42,0.055)] md:flex md:flex-col">
        <Link href="/" className="group flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_8px_18px_rgba(30,90,120,0.14)] transition group-hover:scale-[1.02]">
            <GraduationCap className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold tracking-tight text-sidebar-foreground">研途 Hub</span>
            <span className="block text-xs text-muted-foreground">研究生科研工作台</span>
          </span>
        </Link>

        <div className="mt-4 rounded-xl border border-sidebar-border/80 bg-white/58 p-2">
          <div className="flex items-center gap-2 rounded-lg border border-sidebar-border/75 bg-white/78 px-2.5 py-2 text-xs text-muted-foreground">
            <Command className="size-3.5 text-sidebar-primary" />
            <span className="truncate">打开后先看下一步</span>
          </div>
        </div>

        <Separator className="my-4 bg-sidebar-border/80" />
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
          工作流
        </p>
        <nav className="grid gap-1.5">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <nav className="mt-4 grid gap-1.5 border-t border-sidebar-border/80 pt-4">
          {utilityItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="mt-auto rounded-xl border border-sidebar-border/80 bg-white/66 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
          <div className="flex items-center gap-2">
            <TimerReset className="size-4 text-sidebar-primary" />
            <p className="text-xs font-semibold text-sidebar-foreground">今天只做三件事</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            推进一个关键任务，留下一个实验证据，写清楚下一步。
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <CircleDot className="size-3 text-sidebar-primary" />
            <span>记录越轻，复盘越稳</span>
          </div>
        </div>
      </aside>

      <div className="md:pl-[17rem]">
        <header className="sticky top-0 z-30 border-b border-border/75 bg-white/72 backdrop-blur-xl">
          <div className="flex flex-col gap-2 px-3 py-2 md:min-h-16 md:px-4 md:py-3 lg:flex-row lg:items-center lg:justify-between lg:px-7">
            <div className="flex items-center justify-between gap-3 md:hidden">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-primary" />
                <span className="text-sm font-semibold">研途 Hub</span>
              </div>
              <div className="rounded-full border bg-white/82 px-2 py-1 text-[11px] text-muted-foreground">
                自托管
              </div>
            </div>
            <form action={quickCapture} className="flex w-full max-w-3xl items-center gap-1.5 md:gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="content"
                  placeholder="快速捕捉..."
                  className="h-9 rounded-xl border-border/75 bg-white/95 pl-8 text-sm shadow-[0_1px_1px_rgba(15,23,42,0.04)] md:h-10"
                />
              </div>
              <Button type="submit" className="h-9 shrink-0 px-3 md:h-10 md:px-4">
                <Sparkles className="size-4" />
                捕捉
              </Button>
            </form>
            <div className="hidden items-center gap-2 rounded-xl border bg-white/76 px-3 py-2 text-xs text-muted-foreground shadow-sm xl:flex">
              <CircleDot className="size-3 text-primary" />
              <span>本地数据 · 自托管</span>
            </div>
            <div className="-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-0.5 md:hidden">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} compact />
              ))}
            </div>
          </div>
        </header>
        <main className="workspace-page mx-auto w-full max-w-[92rem] px-4 py-4 md:py-6 lg:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}
