import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileChartColumn,
  FlaskConical,
  Lightbulb,
  NotebookPen,
  PenLine,
  Sparkles,
  TimerReset,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { TagList } from "@/components/shared/tag-list";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { daysUntil, formatDate, formatDateTime, parseJson, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type QueueItem = {
  id: string;
  title: string;
  href: string;
  kind: string;
  dueDate: Date | null;
  meta: string;
  tone: "task" | "admin";
};

export default async function DashboardPage() {
  const [
    taskCounts,
    upcomingTasks,
    recentExperiments,
    recentPapers,
    recentNotes,
    adminItems,
    projects,
    results,
  ] = await Promise.all([
    prisma.task.groupBy({ by: ["status"], _count: true }),
    prisma.task.findMany({
      where: { status: { not: "done" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 7,
      include: { milestone: { include: { project: true } } },
    }),
    prisma.experiment.findMany({
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: { project: true, results: true },
    }),
    prisma.paper.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.note.findMany({
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.adminItem.findMany({
      where: { status: { not: "done" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.project.findMany({
      where: { status: "active" },
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: {
        milestones: {
          orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
          take: 2,
          include: { tasks: true },
        },
      },
    }),
    prisma.result.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { experiment: true, dataset: true },
    }),
  ]);

  const todo = taskCounts.find((item) => item.status === "todo")?._count ?? 0;
  const doing = taskCounts.find((item) => item.status === "doing")?._count ?? 0;
  const done = taskCounts.find((item) => item.status === "done")?._count ?? 0;
  const totalTasks = todo + doing + done;
  const openTasks = todo + doing;
  const completion = totalTasks ? Math.round((done / totalTasks) * 100) : 0;
  const runningExperiments = recentExperiments.filter(
    (experiment) => experiment.status === "running",
  ).length;
  const readingPapers = recentPapers.filter((paper) => paper.readStatus === "reading").length;
  const unreadPapers = recentPapers.filter((paper) => paper.readStatus === "unread").length;
  const manuscriptReady = results.filter((result) => {
    const config = parseJson<{ manuscriptReady?: boolean }>(result.config, {});
    return config.manuscriptReady || Boolean(result.artifactPath);
  }).length;
  const verifiedResults = results.filter((result) => {
    const config = parseJson<{ reproducibility?: string }>(result.config, {});
    return config.reproducibility === "verified";
  }).length;

  const queue = [
    ...upcomingTasks.map<QueueItem>((task) => ({
      id: task.id,
      title: task.title,
      href: "/projects",
      kind: "任务",
      dueDate: task.dueDate,
      meta: task.milestone?.project.title ?? task.milestone?.title ?? "独立任务",
      tone: "task",
    })),
    ...adminItems.map<QueueItem>((item) => ({
      id: item.id,
      title: item.title,
      href: "/admin",
      kind: statusLabel(item.type),
      dueDate: item.dueDate,
      meta: item.location ?? "事务提醒",
      tone: "admin",
    })),
  ]
    .sort((left, right) => dueRank(left.dueDate) - dueRank(right.dueDate))
    .slice(0, 7);

  const focusItem = queue[0];

  return (
    <div className="grid gap-5">
      <section className="dashboard-hero overflow-hidden rounded-2xl border border-border/70 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.08)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/65 bg-white/72 px-2.5 py-1 text-xs font-medium text-[#315266]">
                <Sparkles className="size-3.5" />
                今日作战台
              </span>
              <span className="rounded-full border border-white/55 bg-white/54 px-2.5 py-1 text-xs text-muted-foreground">
                文献 · 实验 · 项目 · 写作
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-[2.15rem] font-semibold leading-tight tracking-tight text-[#173042] md:text-[2.7rem]">
              先抓住下一步，再补齐科研证据链。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#557083]">
              研途 Hub 负责把 Zotero、实验记录、项目任务和笔记之间的断点收进一个轻量工作台。
              每天打开后，先知道该推进什么，再决定要不要深挖某个模块。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link className={buttonVariants({ variant: "default" })} href="/projects">
                <ClipboardList className="size-4" />
                查看下一步
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/experiments">
                <NotebookPen className="size-4" />
                记录实验
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/papers">
                <BookOpenText className="size-4" />
                同步文献
              </Link>
            </div>
          </div>

          <Card className="border-white/72 bg-white/76 shadow-[0_16px_34px_rgba(27,42,56,0.08)] backdrop-blur">
            <CardContent className="grid gap-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">现在最值得处理</p>
                  <h2 className="mt-1 line-clamp-2 text-xl font-semibold tracking-tight">
                    {focusItem?.title ?? "先建立第一条任务或实验记录"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {focusItem ? `${focusItem.kind} · ${focusItem.meta}` : "让首页开始帮你排序"}
                  </p>
                </div>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#173042] text-white shadow-sm">
                  <TimerReset className="size-5" />
                </span>
              </div>
              <div className="rounded-xl border border-[#d6e7ea] bg-[#f6fbfb]/80 p-3">
                <p className="text-xs text-muted-foreground">截止状态</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {focusItem ? dueText(focusItem.dueDate) : "暂无压力"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ResearchSignal
          icon={ClipboardList}
          label="待推进"
          value={`${openTasks} 个`}
          detail={totalTasks ? `完成度 ${completion}%` : "还没有任务"}
          href="/projects"
        />
        <ResearchSignal
          icon={FlaskConical}
          label="实验节奏"
          value={`${runningExperiments} 个进行中`}
          detail={recentExperiments[0]?.title ?? "先记录一次实验"}
          href="/experiments"
        />
        <ResearchSignal
          icon={BookOpenText}
          label="文献队列"
          value={`${readingPapers + unreadPapers} 篇待处理`}
          detail={recentPapers[0]?.title ?? "同步 Zotero 后显示"}
          href="/papers"
        />
        <ResearchSignal
          icon={FileChartColumn}
          label="成果证据"
          value={`${manuscriptReady} 条可写入`}
          detail={`${verifiedResults} 条已复现`}
          href="/data"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="workbench-card">
          <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" />
                下一步队列
              </CardTitle>
              <Link href="/projects" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                项目看板
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {queue.length ? (
              <div className="grid gap-2">
                {queue.map((item) => (
                  <Link
                    key={`${item.tone}-${item.id}`}
                    href={item.href}
                    className="group grid gap-3 rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3.5 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white hover:shadow-[0_10px_26px_rgba(27,42,56,0.06)] sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  >
                    <span
                      className={
                        item.tone === "task"
                          ? "flex size-9 items-center justify-center rounded-xl bg-[#eaf3f4] text-[#315266]"
                          : "flex size-9 items-center justify-center rounded-xl bg-[#f4efe5] text-[#7a5a2f]"
                      }
                    >
                      {item.tone === "task" ? (
                        <ClipboardList className="size-4" />
                      ) : (
                        <CalendarClock className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="line-clamp-1 font-medium">{item.title}</p>
                        <span className="rounded-md border bg-white/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {item.kind}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-primary">
                      {dueText(item.dueDate)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="暂无近期事项"
                description="去项目页添加任务，或在事务页登记组会、材料和报销。"
              />
            )}
          </CardContent>
        </Card>

        <Card className="workbench-card">
          <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              研究闭环
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <LoopRow
              icon={BookOpenText}
              title="文献输入"
              value={`${recentPapers.length} 篇最近同步`}
              detail={recentPapers[0]?.title ?? "先连接 Zotero"}
              href="/papers"
            />
            <LoopRow
              icon={FlaskConical}
              title="实验验证"
              value={`${recentExperiments.length} 条最近记录`}
              detail={recentExperiments[0]?.project?.title ?? "记录目的、方法、结果和下一步"}
              href="/experiments"
            />
            <LoopRow
              icon={FileChartColumn}
              title="结果证据"
              value={`${results.length} 条结果`}
              detail={results[0]?.title ?? "把关键指标留下来"}
              href="/data"
            />
            <LoopRow
              icon={PenLine}
              title="笔记写作"
              value={`${recentNotes.length} 条最近笔记`}
              detail={recentNotes[0]?.title ?? "把想法快速捕捉下来"}
              href="/notes"
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="workbench-card">
          <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="size-4 text-primary" />
                最近实验
              </CardTitle>
              <Link href="/experiments" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                实验记录
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {recentExperiments.length ? (
              recentExperiments.map((experiment) => (
                <div key={experiment.id} className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{experiment.title}</p>
                    <StatusBadge value={experiment.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {experiment.project?.title ?? "未关联项目"} · 更新 {formatDateTime(experiment.updatedAt)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    已登记结果 {experiment.results.length} 条
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">还没有实验记录。</p>
            )}
          </CardContent>
        </Card>

        <Card className="workbench-card">
          <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <BookOpenText className="size-4 text-primary" />
                文献与笔记
              </CardTitle>
              <Link href="/papers" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                文献台
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            <div className="grid content-start gap-2">
              {recentPapers.length ? (
                recentPapers.slice(0, 3).map((paper) => (
                  <div key={paper.id} className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3.5">
                    <p className="line-clamp-2 font-medium">{paper.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {paper.year ?? "年份未知"} · {statusLabel(paper.readStatus)}
                    </p>
                    <div className="mt-2">
                      <TagList value={paper.tags} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">同步 Zotero 后显示最近文献。</p>
              )}
            </div>
            <div className="grid content-start gap-2">
              {recentNotes.length ? (
                recentNotes.slice(0, 3).map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes?note=${note.id}`}
                    className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3.5 transition hover:border-primary/25 hover:bg-white"
                  >
                    <p className="line-clamp-1 font-medium">{note.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {note.folder} · 更新 {formatDate(note.updatedAt)}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">用顶部快速捕捉记录灵感。</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="workbench-card">
          <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              活跃项目
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {projects.length ? (
              projects.map((project) => {
                const taskTotal = project.milestones.reduce(
                  (sum, milestone) => sum + milestone.tasks.length,
                  0,
                );
                const taskDone = project.milestones.reduce(
                  (sum, milestone) =>
                    sum + milestone.tasks.filter((task) => task.status === "done").length,
                  0,
                );

                return (
                  <Link
                    key={project.id}
                    href="/projects"
                    className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3.5 transition hover:border-primary/25 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-1 font-medium">{project.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {project.milestones[0]?.title ?? "暂无里程碑"}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {taskDone}/{taskTotal || 0}
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">创建项目后，这里会显示正在推进的课题。</p>
            )}
          </CardContent>
        </Card>

        <Card className="workbench-card">
          <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
            <CardTitle className="flex items-center gap-2">
              <FileChartColumn className="size-4 text-primary" />
              最近结果
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {results.length ? (
              results.slice(0, 4).map((result) => {
                const metrics = parseJson<Record<string, number | string>>(result.metrics, {});
                const firstMetric = Object.entries(metrics)[0];

                return (
                  <Link
                    key={result.id}
                    href="/data"
                    className="grid gap-2 rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3.5 transition hover:border-primary/25 hover:bg-white sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-1 font-medium">{result.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {result.experiment?.title ?? "未关联实验"} · {result.dataset?.name ?? "未关联数据集"}
                      </p>
                    </div>
                    <span className="rounded-lg border bg-white/86 px-2.5 py-1 text-xs text-muted-foreground">
                      {firstMetric ? `${firstMetric[0]} ${firstMetric[1]}` : "无指标"}
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">记录结果后，这里会显示可复盘的证据。</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ResearchSignal({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full border-border/72 bg-white/86 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white hover:shadow-[0_12px_28px_rgba(27,42,56,0.07)]">
        <CardContent className="flex h-full items-start gap-3 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d7e7ea] bg-[#eef7f7] text-[#315266] transition group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 line-clamp-1 text-lg font-semibold tracking-tight">{value}</p>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{detail}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function LoopRow({
  icon: Icon,
  title,
  value,
  detail,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="grid gap-3 rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3.5 transition hover:border-primary/25 hover:bg-white sm:grid-cols-[auto_1fr_auto] sm:items-center"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-[#eef4f2] text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{title}</p>
          <span className="text-xs text-muted-foreground">{value}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{detail}</p>
      </div>
      <ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
    </Link>
  );
}

function dueText(value: Date | null) {
  const distance = daysUntil(value);
  if (distance === null) {
    return "无截止";
  }

  if (distance < 0) {
    return `逾期 ${Math.abs(distance)} 天`;
  }

  if (distance === 0) {
    return "今天截止";
  }

  if (distance === 1) {
    return "明天截止";
  }

  return `${distance} 天后`;
}

function dueRank(value: Date | null) {
  const distance = daysUntil(value);
  return distance ?? 9999;
}
