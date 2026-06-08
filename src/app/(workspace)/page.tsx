import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  CalendarClock,
  CheckCircle2,
  CircleCheck,
  ClipboardList,
  Database,
  FileText,
  FileChartColumn,
  FlaskConical,
  FolderKanban,
  History,
  Lightbulb,
  NotebookPen,
  PenLine,
  Settings,
  Sparkles,
  TimerReset,
  UploadCloud,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createDailyPlanNote,
  createFirstRunGuideNote,
  createMeetingBriefNote,
} from "@/lib/actions";
import { getDailyPlanPeriod } from "@/lib/daily-plan";
import { prisma } from "@/lib/db";
import { daysUntil, formatDateTime, parseJson, statusLabel } from "@/lib/format";
import { getMeetingBriefPeriod } from "@/lib/meeting-brief";

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

type TimelineItem = {
  id: string;
  title: string;
  href: string;
  kind: "文献" | "实验" | "结果" | "笔记";
  meta: string;
  updatedAt: Date;
  tone: "paper" | "experiment" | "result" | "note";
};

type ClosingItem = {
  id: string;
  title: string;
  href: string;
  kind: "任务" | "实验" | "结果" | "文献";
  reason: string;
  action: string;
  tone: "urgent" | "watch" | "quiet";
};

export default async function DashboardPage() {
  const dailyPlanPeriod = getDailyPlanPeriod();
  const meetingBriefPeriod = getMeetingBriefPeriod();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const staleSince = new Date(todayStart);
  staleSince.setDate(staleSince.getDate() - 7);
  const readingSince = new Date(todayStart);
  readingSince.setDate(readingSince.getDate() - 14);
  const [
    taskCounts,
    upcomingTasks,
    staleDoingTasks,
    recentExperiments,
    staleExperiments,
    recentPapers,
    stalePapers,
    recentNotes,
    adminItems,
    projects,
    results,
    currentDailyPlan,
    currentMeetingBrief,
    totalRecords,
  ] = await Promise.all([
    prisma.task.groupBy({ by: ["status"], _count: true }),
    prisma.task.findMany({
      where: { status: { not: "done" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 7,
      include: { milestone: { include: { project: true } } },
    }),
    prisma.task.findMany({
      where: {
        status: "doing",
        updatedAt: { lt: staleSince },
      },
      orderBy: { updatedAt: "asc" },
      take: 3,
      include: { milestone: { include: { project: true } } },
    }),
    prisma.experiment.findMany({
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: { project: true, results: true },
    }),
    prisma.experiment.findMany({
      where: {
        status: "running",
        updatedAt: { lt: staleSince },
      },
      orderBy: { updatedAt: "asc" },
      take: 3,
      include: { project: true, results: true },
    }),
    prisma.paper.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.paper.findMany({
      where: {
        readStatus: { in: ["unread", "reading"] },
        updatedAt: { lt: readingSince },
      },
      orderBy: { updatedAt: "asc" },
      take: 3,
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
    prisma.note.findFirst({
      where: {
        folder: "日计划",
        content: { contains: dailyPlanPeriod.marker, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, updatedAt: true },
    }),
    prisma.note.findFirst({
      where: {
        folder: "组会",
        content: { contains: meetingBriefPeriod.marker, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, updatedAt: true },
    }),
    Promise.all([
      prisma.paper.count(),
      prisma.project.count(),
      prisma.task.count(),
      prisma.experiment.count(),
      prisma.note.count(),
      prisma.dataset.count(),
      prisma.result.count(),
      prisma.adminItem.count(),
    ]).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
  ]);

  if (totalRecords === 0) {
    return <FirstRunDashboard />;
  }

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
  const timeline = [
    ...recentExperiments.map<TimelineItem>((experiment) => ({
      id: experiment.id,
      title: experiment.title,
      href: "/experiments",
      kind: "实验",
      meta: `${statusLabel(experiment.status)} · ${experiment.project?.title ?? "未关联项目"} · 结果 ${experiment.results.length} 条`,
      updatedAt: experiment.updatedAt,
      tone: "experiment",
    })),
    ...results.map<TimelineItem>((result) => {
      const metrics = parseJson<Record<string, number | string>>(result.metrics, {});
      const firstMetric = Object.entries(metrics)[0];

      return {
        id: result.id,
        title: result.title,
        href: "/data",
        kind: "结果",
        meta: `${result.experiment?.title ?? "未关联实验"} · ${firstMetric ? `${firstMetric[0]} ${firstMetric[1]}` : "无指标"}`,
        updatedAt: result.updatedAt,
        tone: "result",
      };
    }),
    ...recentNotes.map<TimelineItem>((note) => ({
      id: note.id,
      title: note.title,
      href: `/notes?note=${note.id}`,
      kind: "笔记",
      meta: `${note.folder} · ${parseTagsPreview(note.tags)}`,
      updatedAt: note.updatedAt,
      tone: "note",
    })),
    ...recentPapers.map<TimelineItem>((paper) => ({
      id: paper.id,
      title: paper.title,
      href: "/papers",
      kind: "文献",
      meta: `${paper.year ?? "年份未知"} · ${statusLabel(paper.readStatus)}`,
      updatedAt: paper.updatedAt,
      tone: "paper",
    })),
  ]
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
    .slice(0, 8);
  const closingItems = [
    ...upcomingTasks
      .filter((task) => {
        const distance = daysUntil(task.dueDate);
        return distance !== null && distance < 0;
      })
      .map<ClosingItem>((task) => ({
        id: `overdue-${task.id}`,
        title: task.title,
        href: "/projects?scope=today",
        kind: "任务",
        reason: `${dueText(task.dueDate)} · ${task.milestone?.project.title ?? "独立任务"}`,
        action: "今天处理或改期",
        tone: "urgent",
      })),
    ...staleDoingTasks.map<ClosingItem>((task) => ({
      id: `stale-task-${task.id}`,
      title: task.title,
      href: "/projects?status=doing",
      kind: "任务",
      reason: `${ageText(task.updatedAt)}未更新 · ${task.milestone?.project.title ?? "独立任务"}`,
      action: "确认下一步",
      tone: "watch",
    })),
    ...staleExperiments.map<ClosingItem>((experiment) => ({
      id: `stale-experiment-${experiment.id}`,
      title: experiment.title,
      href: "/experiments?status=running",
      kind: "实验",
      reason: `${ageText(experiment.updatedAt)}未更新 · 结果 ${experiment.results.length} 条`,
      action: "补观察或收口",
      tone: "watch",
    })),
    ...results
      .filter((result) => {
        const config = parseJson<{ reproducibility?: string; manuscriptReady?: boolean }>(
          result.config,
          {},
        );
        return config.reproducibility !== "verified" || (!config.manuscriptReady && !result.artifactPath);
      })
      .map<ClosingItem>((result) => ({
        id: `result-${result.id}`,
        title: result.title,
        href: "/data?manuscript=not-ready",
        kind: "结果",
        reason: result.experiment?.title ?? "未关联实验",
        action: "补复现/论文素材",
        tone: "quiet",
      })),
    ...stalePapers.map<ClosingItem>((paper) => ({
      id: `paper-${paper.id}`,
      title: paper.title,
      href: `/papers?status=${paper.readStatus}`,
      kind: "文献",
      reason: `${ageText(paper.updatedAt)}未处理 · ${statusLabel(paper.readStatus)}`,
      action: "标记阅读状态",
      tone: "quiet",
    })),
  ].slice(0, 4);

  return (
    <div className="grid gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 p-4 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-stretch">
          <div className="cockpit-panel min-w-0 rounded-2xl border p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="research-eyebrow">
                <Sparkles className="size-3.5" />
                今日指挥台
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                {dailyPlanPeriod.shortLabel}
              </span>
            </div>
            <p className="mt-5 text-xs font-medium text-muted-foreground">今天最值得处理</p>
            <h1 className="mt-2 max-w-4xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              {focusItem?.title ?? "先建立第一条任务或实验记录"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              {focusItem
                ? `${focusItem.kind} · ${focusItem.meta} · ${dueText(focusItem.dueDate)}。先推进这一项，再补实验、文献或结果证据。`
                : "当前还没有可排序的任务或事务。先用快速捕捉写下一件真实要做的事，首页就会开始帮你收口。"}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {currentDailyPlan ? (
                <Link className={buttonVariants({ variant: "default" })} href={`/notes?note=${currentDailyPlan.id}`}>
                  <FileText className="size-4" />
                  打开今日计划
                </Link>
              ) : (
                <form action={createDailyPlanNote}>
                  <SubmitButton variant="default">
                    <FileText className="size-4" />
                    生成今日计划
                  </SubmitButton>
                </form>
              )}
              <Link className={buttonVariants({ variant: "outline" })} href="/projects?scope=today">
                <ClipboardList className="size-4" />
                看今日任务
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/experiments">
                <NotebookPen className="size-4" />
                记录实验
              </Link>
              <form action={createMeetingBriefNote}>
                <input type="hidden" name="scope" value="week" />
                <SubmitButton variant="outline">
                  <FileText className="size-4" />
                  生成周报草稿
                </SubmitButton>
              </form>
            </div>

            <div className="mt-5 grid gap-2 rounded-2xl action-stack p-3 text-white shadow-[0_18px_36px_rgba(22,34,53,0.15)] md:grid-cols-3">
              <FocusStackItem
                index="01"
                title={focusItem?.title ?? "写下第一件要做的事"}
                detail={focusItem ? dueText(focusItem.dueDate) : "快速捕捉即可开始"}
              />
              <FocusStackItem
                index="02"
                title={closingItems[0]?.title ?? "没有明显收口风险"}
                detail={closingItems[0]?.action ?? "直接推进下一步"}
              />
              <FocusStackItem
                index="03"
                title={recentPapers[0]?.title ?? "同步 Zotero 文献"}
                detail={`${readingPapers + unreadPapers} 篇待读/读中`}
              />
            </div>

            <div className="mt-5 grid gap-3 rounded-xl border border-white/72 bg-white/58 p-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <span className="flex size-11 items-center justify-center rounded-xl ink-tile text-white shadow-sm">
                <TimerReset className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>任务完成度</span>
                  <span className="font-medium hero-title">{completion}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/85">
                  <div
                    className="h-full rounded-full bg-[#365a7d]"
                    style={{ width: `${Math.max(4, completion)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="cockpit-panel grid content-start gap-3 rounded-2xl border p-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-xs font-medium text-muted-foreground">研究流信号</p>
                <h2 className="mt-1 text-base font-semibold hero-title">开工前看一眼</h2>
              </div>
              <span className="rounded-full border border-white/70 bg-white/72 px-2.5 py-1 text-[11px] text-muted-foreground">
                自托管
              </span>
            </div>
            <CockpitRow
              icon={FileText}
              label={currentDailyPlan ? "今日计划" : "今日计划"}
              value={currentDailyPlan ? "已生成" : "待生成"}
              detail={currentDailyPlan ? `更新 ${formatDateTime(currentDailyPlan.updatedAt)}` : "一键整理今天要做的事"}
              href={currentDailyPlan ? `/notes?note=${currentDailyPlan.id}` : "/notes?folder=日计划"}
            />
            <CockpitRow
              icon={TimerReset}
              label="收口提醒"
              value={closingItems.length ? `${closingItems.length} 项` : "稳定"}
              detail={closingItems[0]?.title ?? "没有逾期或久未更新项"}
              href={closingItems[0]?.href ?? "/projects?scope=today"}
            />
            <CockpitRow
              icon={BookOpenText}
              label="文献队列"
              value={`${readingPapers + unreadPapers} 篇`}
              detail={recentPapers[0]?.title ?? "同步 Zotero 后显示"}
              href="/papers"
            />
            <CockpitRow
              icon={FileChartColumn}
              label="证据素材"
              value={`${manuscriptReady} 条`}
              detail={`${verifiedResults} 条已复现`}
              href="/data?manuscript=ready"
            />
          </div>
        </div>
      </section>

      <ResearchRhythm
        next={focusItem?.title ?? "先建立第一条任务"}
        paper={`${readingPapers + unreadPapers} 篇待处理`}
        experiment={`${runningExperiments} 个进行中`}
        evidence={`${manuscriptReady} 条可写入`}
      />

      <section className="grid gap-3 rounded-2xl border border-border/65 bg-white/72 p-3 shadow-[0_10px_24px_rgba(27,42,56,0.032)] lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold hero-title">
            {currentMeetingBrief ? "本周组会/周报草稿已经准备好" : "组会前先生成一版周报草稿"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {currentMeetingBrief
              ? `覆盖 ${meetingBriefPeriod.shortLabel}，最近更新 ${formatDateTime(currentMeetingBrief.updatedAt)}。`
              : "自动汇总本周高优先级任务、临近事务、最近实验、结果证据和待读文献，生成后在笔记页改成能直接汇报的版本。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {currentMeetingBrief ? (
            <Link className={buttonVariants({ variant: "default" })} href={`/notes?note=${currentMeetingBrief.id}`}>
              <FileText className="size-4" />
              继续编辑草稿
            </Link>
          ) : (
            <form action={createMeetingBriefNote}>
              <input type="hidden" name="scope" value="week" />
              <SubmitButton variant="default" className="w-fit">
                <FileText className="size-4" />
                生成周报草稿
              </SubmitButton>
            </form>
          )}
          <Link className={buttonVariants({ variant: "outline" })} href="/notes?folder=组会">
            <NotebookPen className="size-4" />
            查看组会笔记
          </Link>
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

      <ClosingRadar items={closingItems} />

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
                    className="group grid gap-3 soft-tile rounded-xl p-3.5 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white hover:shadow-[0_10px_26px_rgba(27,42,56,0.06)] sm:grid-cols-[auto_1fr_auto] sm:items-center"
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

      <section className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <ResearchTimeline items={timeline} />

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
                    className="soft-tile rounded-xl p-3.5 transition hover:border-primary/25 hover:bg-white"
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
      </section>

      <section className="grid gap-4">
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
                    className="grid gap-2 soft-tile rounded-xl p-3.5 transition hover:border-primary/25 hover:bg-white sm:grid-cols-[1fr_auto] sm:items-center"
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

function FirstRunDashboard() {
  return (
    <div className="grid gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="research-eyebrow">
                <Sparkles className="size-3.5" />
                开箱指挥台
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                先连文献 · 再建课题 · 留下第一条记录
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              先别配置一堆东西，从三件小事开始。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              研途 Hub 的第一天不需要完整迁移资料。先连接 Zotero 或手动补一篇文献，
              建一个正在做的课题，再写下第一条实验/笔记，首页就会开始帮你排序。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <form action={createFirstRunGuideNote}>
                <SubmitButton variant="default">
                  <FileText className="size-4" />
                  生成上手清单
                </SubmitButton>
              </form>
              <Link className={buttonVariants({ variant: "outline" })} href="/papers">
                <UploadCloud className="size-4" />
                同步文献
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/projects">
                <FolderKanban className="size-4" />
                建第一个课题
              </Link>
            </div>
          </div>

          <div className="flex min-h-64 flex-col justify-between rounded-2xl action-stack p-4 text-white shadow-[0_18px_36px_rgba(22,34,53,0.16)]">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-white/68">
                <TimerReset className="size-3.5" />
                10 分钟开箱顺序
              </p>
              <div className="mt-4 grid gap-2.5">
                <FirstRunStep
                  index="01"
                  title="生成 10 分钟上手清单"
                  detail="先得到一篇可勾选路线图，之后在笔记里继续改。"
                  action={createFirstRunGuideNote}
                />
                <FirstRunStep
                  index="02"
                  title="同步 Zotero 或补一篇临时文献"
                  detail="文献不要重复录，阅读状态交给这里。"
                  href="/papers"
                />
                <FirstRunStep
                  index="03"
                  title="创建课题和下一步任务"
                  detail="首页会从任务和事务里自动生成今日队列。"
                  href="/projects"
                />
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-white/62">
              先让工作台跑起来，一周后再决定哪些历史资料值得迁移。
            </p>
          </div>
        </div>
      </section>

      <ResearchRhythm
        next="完成设置中心"
        paper="同步 Zotero"
        experiment="写第一条记录"
        evidence="先别搬旧资料"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StartCard
          icon={Settings}
          title="设置中心"
          detail="修改访问密码、AI Key、Zotero Key 和导出数据。"
          href="/settings"
          action="去设置"
        />
        <StartCard
          icon={BookOpenText}
          title="Zotero 阅读台"
          detail="同步文献集合，给论文标记待读、读中、已读。"
          href="/papers"
          action="同步文献"
        />
        <StartCard
          icon={FolderKanban}
          title="课题路线图"
          detail="建课题、里程碑和下一步任务，不堆复杂字段。"
          href="/projects"
          action="建课题"
        />
        <StartCard
          icon={NotebookPen}
          title="第一条记录"
          detail="写一条实验、笔记或组会提醒，让工作台开始运转。"
          href="/notes?mode=new"
          action="写笔记"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.62fr_0.38fr]">
        <Card className="workbench-card overflow-hidden">
          <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
            <CardTitle className="flex items-center gap-2">
              <CircleCheck className="size-4 text-primary" />
              今天只需要完成这些
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ChecklistRow title="确认设置中心能保存 Key" detail="后续换模型、换 Zotero Key 都在网页端完成。" />
            <ChecklistRow title="把一个真实课题放进去" detail="不要搬历史资料，先放当前正在推进的题目。" />
            <ChecklistRow title="留下第一条能复盘的记录" detail="实验目的、阅读摘录、组会提醒，任选一个。" />
          </CardContent>
        </Card>

        <Card className="workbench-card overflow-hidden">
          <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4 text-primary" />
              暂时不用做
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm leading-6 text-muted-foreground">
            <p>不用先导入全部 PDF。</p>
            <p>不用把所有旧实验搬进来。</p>
            <p>不用配置一堆不常用字段。</p>
            <p>等真实使用一周后，再决定要不要扩展功能。</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function FirstRunStep({
  index,
  title,
  detail,
  href,
  action,
}: {
  index: string;
  title: string;
  detail: string;
  href?: string;
  action?: () => Promise<void>;
}) {
  const content = (
    <>
      <span className="font-mono text-xs font-semibold text-white/50">{index}</span>
      <span className="min-w-0">
        <span className="block font-medium text-white">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-white/58">{detail}</span>
      </span>
      <ArrowRight className="hidden size-4 text-white/45 sm:block" />
    </>
  );

  const className =
    "grid w-full gap-3 rounded-xl border border-white/10 bg-white/[0.07] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.1] sm:grid-cols-[auto_1fr_auto] sm:items-center";

  if (action) {
    return (
      <form action={action}>
        <button type="submit" className={className}>
          {content}
        </button>
      </form>
    );
  }

  return (
    <Link
      href={href ?? "/"}
      className={className}
    >
      {content}
    </Link>
  );
}

function StartCard({
  icon: Icon,
  title,
  detail,
  href,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  href: string;
  action: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full border-border/72 bg-white/86 transition hover:border-primary/25 hover:bg-white hover:shadow-[0_12px_28px_rgba(27,42,56,0.07)]">
        <CardContent className="grid h-full gap-4 py-4">
          <span className="flex size-10 items-center justify-center rounded-xl border border-[#d7e7ea] bg-[#eef7f7] text-[#315266] transition group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="size-4" />
          </span>
          <span>
            <span className="block font-semibold">{title}</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">{detail}</span>
          </span>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
            {action}
            <ArrowRight className="size-3.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function ChecklistRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex gap-3 soft-tile rounded-xl p-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#eef7f7] text-primary">
        <CheckCircle2 className="size-4" />
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
}

function FocusStackItem({
  index,
  title,
  detail,
}: {
  index: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-white/45">{index}</span>
        <span className="h-px flex-1 bg-white/12" />
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 line-clamp-1 text-xs text-white/58">{detail}</p>
    </div>
  );
}

function CockpitRow({
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
    <Link
      href={href}
      className="grid gap-3 rounded-xl border border-white/72 bg-white/68 p-3 transition hover:border-primary/25 hover:bg-white/90 sm:grid-cols-[auto_1fr_auto] sm:items-center"
    >
      <span className="flex size-9 items-center justify-center rounded-xl border border-[#d8e5ee] bg-[#eef4fb] text-[#365a7d]">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="mt-1 block line-clamp-1 text-sm font-semibold hero-title">{detail}</span>
      </span>
      <span className="w-fit rounded-full border border-white/80 bg-white/78 px-2.5 py-1 text-xs font-medium text-[#365a7d]">
        {value}
      </span>
    </Link>
  );
}

function ResearchRhythm({
  next,
  paper,
  experiment,
  evidence,
}: {
  next: string;
  paper: string;
  experiment: string;
  evidence: string;
}) {
  const items = [
    {
      icon: TimerReset,
      label: "先定下一步",
      value: next,
      detail: "减少每天开工前的选择成本",
    },
    {
      icon: BookOpenText,
      label: "文献输入",
      value: paper,
      detail: "Zotero 负责库，这里负责阅读状态",
    },
    {
      icon: FlaskConical,
      label: "实验推进",
      value: experiment,
      detail: "记录目的、观察、结论和下一步",
    },
    {
      icon: FileChartColumn,
      label: "结果证据",
      value: evidence,
      detail: "把能支撑论文的指标留下来",
    },
  ];

  return (
    <section className="research-strip overflow-hidden rounded-2xl border px-3 py-3">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="grid gap-3 rounded-xl border border-border/55 bg-white/70 p-3 sm:grid-cols-[auto_1fr] sm:items-start"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#eef4fb] text-[#365a7d]">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                    0{index + 1}
                  </span>
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                </div>
                <p className="mt-1 line-clamp-1 font-semibold tracking-tight">{item.value}</p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
      <Card className="signal-card h-full transition hover:border-primary/25 hover:bg-white">
        <CardContent className="flex h-full items-start gap-3 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d8e5ee] bg-[#eef4fb] text-[#365a7d] transition group-hover:bg-primary group-hover:text-primary-foreground">
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

function ClosingRadar({ items }: { items: ClosingItem[] }) {
  return (
    <section className="grid gap-3 rounded-2xl border border-border/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,250,253,0.82))] p-3 shadow-[0_12px_28px_rgba(27,42,56,0.036)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold hero-title">
            <TimerReset className="size-4 text-primary" />
            收口提醒
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            只提醒最容易被遗忘的任务、实验、结果和文献，不增加新的配置。
          </p>
        </div>
        <span className="w-fit rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
          {items.length ? `${items.length} 项需要看一眼` : "状态稳定"}
        </span>
      </div>

      {items.length ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group grid gap-3 rounded-xl border border-border/65 bg-white/76 p-3 transition hover:border-primary/25 hover:bg-white hover:shadow-[0_10px_24px_rgba(27,42,56,0.045)] sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <span className={closingToneClass(item.tone)}>{item.kind}</span>
              <span className="min-w-0">
                <span className="block line-clamp-1 font-medium">{item.title}</span>
                <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">
                  {item.reason}
                </span>
              </span>
              <span className="text-xs font-medium text-primary">{item.action}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#cfe0df] bg-white/58 p-3 text-sm text-muted-foreground">
          暂时没有逾期任务、久未更新实验或待补证据。今天可以直接从“下一步队列”开始。
        </div>
      )}
    </section>
  );
}

function closingToneClass(tone: ClosingItem["tone"]) {
  const classes = {
    urgent: "flex h-8 shrink-0 items-center justify-center rounded-lg bg-[#fff1f2] px-2 text-xs font-medium text-rose-700",
    watch: "flex h-8 shrink-0 items-center justify-center rounded-lg bg-[#fff7e6] px-2 text-xs font-medium text-[#7a5a2f]",
    quiet: "flex h-8 shrink-0 items-center justify-center rounded-lg bg-[#eef7f3] px-2 text-xs font-medium text-[#2f6655]",
  };

  return classes[tone];
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
      className="grid gap-3 rounded-xl border border-border/72 bg-white/78 p-3.5 transition hover:border-primary/25 hover:bg-white sm:grid-cols-[auto_1fr_auto] sm:items-center"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-[#eef3fb] text-primary">
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

function ResearchTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <Card className="workbench-card overflow-hidden">
      <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            研究时间线
          </CardTitle>
          <Link href="/notes?folder=组会" className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            用于组会回顾
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <div className="grid gap-2">
            {items.map((item) => {
              const Icon = timelineIcon(item.tone);

              return (
                <Link
                  key={`${item.tone}-${item.id}`}
                  href={item.href}
                  className="group grid gap-3 rounded-xl border border-border/70 bg-[#fbfcfd]/88 p-3.5 transition hover:border-primary/25 hover:bg-white hover:shadow-[0_10px_26px_rgba(27,42,56,0.055)] sm:grid-cols-[auto_1fr_auto] sm:items-center"
                >
                  <span className={timelineIconClass(item.tone)}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="line-clamp-1 font-medium">{item.title}</span>
                      <span className="rounded-md border bg-white/82 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {item.kind}
                      </span>
                    </span>
                    <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">
                      {item.meta}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-primary">
                    {formatDateTime(item.updatedAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="暂无研究时间线"
            description="同步文献、记录实验、写笔记或登记结果后，这里会自动串成可回顾的轨迹。"
          />
        )}
      </CardContent>
    </Card>
  );
}

function timelineIcon(tone: TimelineItem["tone"]) {
  const icons = {
    paper: BookOpenText,
    experiment: FlaskConical,
    result: FileChartColumn,
    note: PenLine,
  };

  return icons[tone];
}

function timelineIconClass(tone: TimelineItem["tone"]) {
  const classes = {
    paper: "flex size-9 items-center justify-center rounded-xl bg-[#eef3fb] text-primary",
    experiment: "flex size-9 items-center justify-center rounded-xl bg-[#eef7f3] text-[#2f6655]",
    result: "flex size-9 items-center justify-center rounded-xl bg-[#f7f1df] text-[#7a5a2f]",
    note: "flex size-9 items-center justify-center rounded-xl bg-[#f3eef9] text-[#5d4d80]",
  };

  return classes[tone];
}

function parseTagsPreview(value: string) {
  const tags = parseJson<string[]>(value, []);
  return tags.length ? tags.slice(0, 2).join(" / ") : "无标签";
}

function ageText(value: Date) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  const days = Math.max(1, Math.floor((start.getTime() - target.getTime()) / 86_400_000));

  return `${days} 天`;
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
