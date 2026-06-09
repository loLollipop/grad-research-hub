import Link from "next/link";
import {
  BookOpenText,
  CheckCircle2,
  CircleDot,
  Command,
  FileChartColumn,
  FlaskConical,
  GraduationCap,
  Layers3,
  Search,
  Sparkles,
  TimerReset,
} from "lucide-react";

import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { quickCapture } from "@/lib/actions";

const navItems = [
  { href: "/", label: "首页", icon: "home" },
  { href: "/papers", label: "文献", icon: "papers" },
  { href: "/experiments", label: "实验", icon: "experiments" },
  { href: "/projects", label: "课题", icon: "projects" },
  { href: "/notes", label: "笔记", icon: "notes" },
  { href: "/data", label: "成果", icon: "data" },
  { href: "/admin", label: "事务", icon: "admin" },
] as const;

const utilityItems = [
  { href: "/ai", label: "AI", icon: "ai" },
  { href: "/settings", label: "设置", icon: "settings" },
] as const;

const captureExamples = [
  "任务 整理今天的实验观察",
  "实验 复现论文里的关键对照",
  "结果 消融实验准确率提升 2%",
  "文献 补读最新综述",
  "组会 周五汇报准备图表",
  "想法 把失败样本单独分析",
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const mobileItems = [...navItems, ...utilityItems];

  return (
    <div className="workbench-surface min-h-screen text-foreground">
      <aside className="sidebar-panel fixed inset-y-0 left-0 hidden w-[17rem] border-r border-sidebar-border/80 px-4 py-4 text-sidebar-foreground shadow-[10px_0_32px_rgba(15,23,42,0.035)] md:flex md:flex-col">
        <Link href="/" className="group flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="brand-mark">
            <GraduationCap className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold tracking-tight text-sidebar-foreground">
              研途 Hub
            </span>
            <span className="block text-xs text-muted-foreground">理工科研究生工作台</span>
          </span>
        </Link>

        <div className="research-loop-card mt-4">
          <div className="flex items-center gap-2 rounded-xl border border-sidebar-border/65 bg-white/86 px-2.5 py-2 text-xs text-muted-foreground">
            <Command className="size-3.5 text-sidebar-primary" />
            <span className="truncate">一句话进入研究流</span>
          </div>
          <div className="research-loop-rail mt-3">
            <FlowHint icon={BookOpenText} label="文献" detail="Zotero 队列" />
            <FlowHint icon={FlaskConical} label="实验" detail="目的/观察" />
            <FlowHint icon={FileChartColumn} label="成果" detail="证据/复现" />
            <FlowHint icon={CheckCircle2} label="写作" detail="周报/论文" />
          </div>
        </div>

        <Separator className="my-4 bg-sidebar-border/80" />
        <p className="mb-2 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
          <Layers3 className="size-3" />
          研究闭环
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

        <div className="mt-auto rounded-2xl border border-sidebar-border/70 bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_22px_rgba(34,48,71,0.032)]">
          <div className="flex items-center gap-2">
            <TimerReset className="size-4 text-sidebar-primary" />
            <p className="text-xs font-semibold text-sidebar-foreground">今天只先抓三件事</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            推进一个关键任务，留下一条实验证据，把下一步写回笔记。
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <CircleDot className="size-3 text-sidebar-primary" />
            <span>记录越轻，复盘越稳</span>
          </div>
        </div>
      </aside>

      <div className="md:pl-[17rem]">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-white/80 backdrop-blur-xl">
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
            <form action={quickCapture} className="w-full max-w-3xl">
              <div className="command-bar flex items-center gap-1.5 rounded-2xl border border-border/60 bg-white/68 p-1 md:gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="content"
                    list="quick-capture-examples"
                    placeholder="一句话捕捉：任务 / 实验 / 结果 / 文献 / 组会 / 想法"
                    className="h-9 rounded-xl border-transparent bg-white/0 pl-8 text-sm shadow-none focus-visible:bg-white/88 md:h-10"
                  />
                  <datalist id="quick-capture-examples">
                    {captureExamples.map((example) => (
                      <option key={example} value={example} />
                    ))}
                  </datalist>
                </div>
                <Button type="submit" className="h-9 shrink-0 rounded-xl px-3 md:h-10 md:px-4">
                  <Sparkles className="size-4" />
                  捕捉
                </Button>
              </div>
              <div className="mt-1.5 hidden gap-1.5 overflow-x-auto px-1 lg:flex">
                {captureExamples.slice(0, 5).map((example) => (
                  <button
                    key={example}
                    type="submit"
                    name="content"
                    value={example}
                    className="shrink-0 rounded-full border border-border/60 bg-white/58 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/25 hover:bg-white/86 hover:text-primary"
                    title={`快速创建：${example}`}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </form>
            <div className="hidden items-center gap-2 rounded-2xl border bg-white/76 px-3 py-2 text-xs text-muted-foreground shadow-sm xl:flex">
              <CircleDot className="size-3 text-primary" />
              <span>本地数据 · Zotero / AI 在设置中心维护</span>
            </div>
            <div className="-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-0.5 md:hidden">
              {mobileItems.map((item) => (
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

function FlowHint({
  icon: Icon,
  label,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
}) {
  return (
    <div className="research-loop-step">
      <span className="flex min-w-0 items-center gap-2">
        <span className="research-loop-step-icon">
          <Icon className="size-3.5" />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="ml-auto truncate text-[11px] font-normal text-muted-foreground">{detail}</span>
    </div>
  );
}
