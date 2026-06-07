import Link from "next/link";
import {
  BarChart3,
  Bot,
  ClipboardList,
  Database,
  FlaskConical,
  GraduationCap,
  Home,
  NotebookTabs,
  ScrollText,
  Settings,
} from "lucide-react";

import { quickCapture } from "@/lib/actions";
import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/", label: "首页", icon: Home },
  { href: "/papers", label: "文献", icon: ScrollText },
  { href: "/experiments", label: "实验", icon: FlaskConical },
  { href: "/projects", label: "项目", icon: BarChart3 },
  { href: "/notes", label: "笔记", icon: NotebookTabs },
  { href: "/data", label: "数据", icon: Database },
  { href: "/admin", label: "事务", icon: ClipboardList },
];

const utilityItems = [
  { href: "/ai", label: "AI", icon: Bot },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f7f2_0%,#ffffff_38%)] text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-white/92 px-4 py-4 backdrop-blur md:flex md:flex-col">
        <Link href="/" className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#1f3d33] text-white">
            <GraduationCap className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">研途 Hub</span>
            <span className="block text-xs text-muted-foreground">研究生工作台</span>
          </span>
        </Link>
        <Separator className="my-4" />
        <nav className="grid gap-1">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <nav className="mt-4 grid gap-1 border-t pt-4">
          {utilityItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
        <div className="mt-auto rounded-lg border bg-[#fbfaf4] p-3">
          <p className="text-xs font-medium">本周节奏</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            先固定数据版本，再推进实验复现和周报汇总。
          </p>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 border-b bg-white/85 backdrop-blur">
          <div className="flex min-h-14 flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <GraduationCap className="size-5 text-[#1f3d33]" />
              <span className="text-sm font-semibold">研途 Hub</span>
            </div>
            <form action={quickCapture} className="flex w-full max-w-2xl items-center gap-2">
              <Input
                name="content"
                placeholder="快速捕捉：一句灵感、一个导师提醒、一个待办..."
                className="h-9 bg-white"
              />
              <Button type="submit" variant="outline" className="shrink-0">
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
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
