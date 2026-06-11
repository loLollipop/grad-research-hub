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
  TimerReset,
} from "lucide-react";

import { NavLink } from "@/components/layout/nav-link";
import { QuickCaptureBar } from "@/components/layout/quick-capture-bar";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/", label: "首页", detail: "今天先走哪步", icon: "home" },
  { href: "/papers", label: "文献", detail: "同步后只读三篇", icon: "papers" },
  { href: "/experiments", label: "实验", detail: "记录纸与观察", icon: "experiments" },
  { href: "/projects", label: "课题", detail: "阶段和下一步", icon: "projects" },
  { href: "/notes", label: "笔记", detail: "写作素材桌", icon: "notes" },
  { href: "/data", label: "成果", detail: "结果可讲度", icon: "data" },
  { href: "/admin", label: "事务", detail: "小事别占脑子", icon: "admin" },
] as const;

const utilityItems = [
  { href: "/ai", label: "AI", detail: "组会/复盘草稿", icon: "ai" },
  { href: "/settings", label: "设置", detail: "连接中心", icon: "settings" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const mobileItems = [...navItems, ...utilityItems];

  return (
    <div className="workbench-surface min-h-screen text-foreground">
      <aside className="sidebar-panel fixed inset-y-0 left-0 hidden w-[18rem] border-r border-sidebar-border/62 px-3.5 py-4 text-sidebar-foreground shadow-[14px_0_38px_rgba(38,45,45,0.026)] md:flex md:flex-col">
        <Link href="/" className="sidebar-brand group">
          <span className="brand-mark">
            <GraduationCap className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold tracking-tight text-sidebar-foreground">
              研途 Hub
            </span>
            <span className="block text-xs text-muted-foreground">科研行动台</span>
          </span>
          <span className="ml-auto rounded-full border border-white/70 bg-white/62 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            self-host
          </span>
        </Link>

        <div className="sidebar-flow-card mt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-semibold text-sidebar-foreground">
                <Command className="size-3.5 text-sidebar-primary" />
                研究流
              </p>
            </div>
            <span className="rounded-full border border-sidebar-border/70 bg-white/62 px-2 py-0.5 text-[10px] text-muted-foreground">
              4 步
            </span>
          </div>
          <div className="research-loop-rail mt-3">
            <FlowHint index="01" icon={BookOpenText} label="文献输入" detail="Zotero 队列" />
            <FlowHint index="02" icon={FlaskConical} label="实验验证" detail="目的/观察" />
            <FlowHint index="03" icon={FileChartColumn} label="结果证据" detail="复现/图表" />
            <FlowHint index="04" icon={CheckCircle2} label="写作输出" detail="周报/论文" />
          </div>
        </div>

        <Separator className="my-3.5 bg-sidebar-border/70" />
        <p className="mb-2 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/72">
          <Layers3 className="size-3" />
          工作区
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

        <div className="sidebar-focus-card mt-auto">
          <div className="flex items-center gap-2">
            <TimerReset className="size-4 text-sidebar-primary" />
            <p className="text-xs font-semibold text-sidebar-foreground">今天只抓三件事</p>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <CircleDot className="size-3 text-sidebar-primary" />
            <span>任务 · 证据 · 下一步</span>
          </div>
        </div>
      </aside>

      <div className="md:pl-[18rem]">
        <header className="sticky top-0 z-30 border-b border-border/52 bg-[#fbfaf4]/74 backdrop-blur-xl">
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
            <QuickCaptureBar />
            <div className="hidden items-center gap-2 rounded-2xl border border-border/54 bg-white/50 px-3 py-2 text-xs text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] xl:flex">
              <CircleDot className="size-3 text-primary" />
              <span>本地数据 · 设置中心</span>
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
  index,
  icon: Icon,
  label,
  detail,
}: {
  index: string;
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
        <span className="min-w-0">
          <span className="block truncate">{label}</span>
          <span className="mt-0.5 block font-mono text-[10px] font-semibold text-muted-foreground/62">
            {index}
          </span>
        </span>
      </span>
      <span className="ml-auto truncate text-[11px] font-normal text-muted-foreground">{detail}</span>
    </div>
  );
}
