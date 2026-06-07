import Link from "next/link";
import { GraduationCap, Search, Sparkles } from "lucide-react";

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
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-sidebar-border bg-sidebar/92 px-4 py-4 backdrop-blur md:flex md:flex-col">
        <Link href="/" className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-tight">研途 Hub</span>
            <span className="block text-xs text-muted-foreground">研究生工作台</span>
          </span>
        </Link>

        <Separator className="my-4 bg-sidebar-border" />
        <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          工作流
        </p>
        <nav className="grid gap-1.5">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <nav className="mt-4 grid gap-1.5 border-t border-sidebar-border pt-4">
          {utilityItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="workbench-panel mt-auto rounded-md p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="text-xs font-medium">本周节奏</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            今天先收束一个关键结果，再写清楚下一步。
          </p>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-background/82 backdrop-blur">
          <div className="flex min-h-14 flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <GraduationCap className="size-5 text-primary" />
              <span className="text-sm font-semibold">研途 Hub</span>
            </div>
            <form action={quickCapture} className="flex w-full max-w-2xl items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="content"
                  placeholder="快速捕捉：灵感、导师提醒、待办..."
                  className="h-9 bg-white/90 pl-8 shadow-sm"
                />
              </div>
              <Button type="submit" variant="outline" className="h-9 shrink-0 bg-white/90">
                捕捉
              </Button>
            </form>
            <div className="flex items-center gap-2 overflow-x-auto md:hidden">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} compact />
              ))}
            </div>
          </div>
        </header>
        <main className="workspace-page mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
