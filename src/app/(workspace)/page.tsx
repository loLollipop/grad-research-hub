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
import { QuickCaptureBar } from "@/components/layout/quick-capture-bar";
import { SubmitButton } from "@/components/shared/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createClosingReviewNote,
  createDailyPlanNote,
  createExperimentCloseoutNote,
  createFirstRunGuideNote,
  createMeetingBriefNote,
  createNoteCloseoutNote,
  createProjectProgressNote,
  createReadingPlanNote,
  createResultCloseoutNote,
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

type OpeningAction = {
  id: string;
  title: string;
  href: string;
  kind: "任务" | "事务" | "实验" | "结果" | "文献";
  detail: string;
  action: string;
  rank: number;
};

type WorkspaceCounts = {
  papers: number;
  projects: number;
  tasks: number;
  experiments: number;
  notes: number;
  datasets: number;
  results: number;
  adminItems: number;
  substantive: number;
};

type GuideNoteSummary = {
  id: string;
  updatedAt: Date;
};

type ChecklistCandidate = {
  id: string;
  title: string;
};

const FIRST_RUN_GUIDE_MARKER = "first-run-guide:v1";

export default async function DashboardPage() {
  const now = new Date();
  const dailyPlanPeriod = getDailyPlanPeriod(now);
  const meetingBriefPeriod = getMeetingBriefPeriod(now);
  const todayMeetingBriefPeriod = getMeetingBriefPeriod(now, "today");
  const todayStart = new Date(now);
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
    readingPlanPapers,
    recentNotes,
    adminItems,
    projects,
    results,
    currentDailyPlan,
    currentMeetingBrief,
    currentTodayMeetingBrief,
    workspaceCounts,
    currentFirstRunGuide,
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
    prisma.paper.findMany({
      where: { readStatus: { in: ["reading", "unread"] } },
      orderBy: [{ readStatus: "asc" }, { updatedAt: "desc" }],
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
    prisma.note.findFirst({
      where: {
        folder: "组会",
        content: { contains: todayMeetingBriefPeriod.marker, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, updatedAt: true },
    }),
    Promise.all([
      prisma.paper.count(),
      prisma.project.count(),
      prisma.task.count(),
      prisma.experiment.count(),
      prisma.note.count({
        where: {
          NOT: {
            content: { contains: FIRST_RUN_GUIDE_MARKER, mode: "insensitive" },
          },
        },
      }),
      prisma.dataset.count(),
      prisma.result.count(),
      prisma.adminItem.count(),
    ]).then<WorkspaceCounts>(
      ([
        papers,
        projects,
        tasks,
        experiments,
        notes,
        datasets,
        results,
        adminItems,
      ]) => ({
        papers,
        projects,
        tasks,
        experiments,
        notes,
        datasets,
        results,
        adminItems,
        substantive:
          papers + projects + tasks + experiments + notes + datasets + results + adminItems,
      }),
    ),
    prisma.note.findFirst({
      where: {
        folder: "上手",
        content: { contains: FIRST_RUN_GUIDE_MARKER, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, updatedAt: true },
    }),
  ]);

  if (workspaceCounts.substantive === 0) {
    return <FirstRunDashboard guideNote={currentFirstRunGuide} />;
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
  const projectPlanTasks = uniqueById([...upcomingTasks, ...staleDoingTasks]).slice(0, 3);
  const experimentCloseoutCandidates = uniqueById([
    ...staleExperiments,
    ...recentExperiments.filter((experiment) => experiment.status !== "completed"),
  ]).slice(0, 3);
  const resultClosingCandidates = results
    .filter((result) => {
      const config = parseJson<{ reproducibility?: string; manuscriptReady?: boolean }>(
        result.config,
        {},
      );
      return config.reproducibility !== "verified" || (!config.manuscriptReady && !result.artifactPath);
    })
    .slice(0, 3);
  const noteCloseoutCandidates = recentNotes
    .filter((note) => !note.content.includes(FIRST_RUN_GUIDE_MARKER))
    .slice(0, 3);
  const dailyChecklistCandidates = {
    experiments: experimentCloseoutCandidates.map(toChecklistCandidate),
    notes: noteCloseoutCandidates.map(toChecklistCandidate),
    papers: readingPlanPapers.map(toChecklistCandidate),
    results: resultClosingCandidates.map(toChecklistCandidate),
    tasks: projectPlanTasks.map(toChecklistCandidate),
  };
  const openingActions = uniqueOpeningActions([
    ...upcomingTasks.map<OpeningAction>((task) => {
      const distance = daysUntil(task.dueDate);

      return {
        id: `task-${task.id}`,
        title: task.title,
        href: "/projects?scope=today",
        kind: "任务",
        detail: `${task.milestone?.project.title ?? task.milestone?.title ?? "独立任务"} · ${dueText(task.dueDate)}`,
        action: distance !== null && distance < 0 ? "先处理逾期" : "推进下一步",
        rank: openingDueRank(task.dueDate) + priorityBias(task.priority),
      };
    }),
    ...adminItems.map<OpeningAction>((item) => {
      const distance = daysUntil(item.dueDate);

      return {
        id: `admin-${item.id}`,
        title: item.title,
        href: "/admin",
        kind: "事务",
        detail: `${statusLabel(item.type)} · ${item.location ?? "事务提醒"} · ${dueText(item.dueDate)}`,
        action: distance !== null && distance <= 0 ? "今天收口" : "提前处理",
        rank: openingDueRank(item.dueDate) + (item.type === "meeting" ? -0.6 : 0),
      };
    }),
    ...staleDoingTasks.map<OpeningAction>((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      href: "/projects?status=doing",
      kind: "任务",
      detail: `${ageText(task.updatedAt)}未更新 · ${task.milestone?.project.title ?? "独立任务"}`,
      action: "确认下一步",
      rank: 6 + priorityBias(task.priority),
    })),
    ...staleExperiments.map<OpeningAction>((experiment) => ({
      id: `experiment-${experiment.id}`,
      title: experiment.title,
      href: "/experiments?status=running",
      kind: "实验",
      detail: `${ageText(experiment.updatedAt)}未更新 · 结果 ${experiment.results.length} 条`,
      action: "补观察或收口",
      rank: 7,
    })),
    ...results
      .filter((result) => {
        const config = parseJson<{ reproducibility?: string; manuscriptReady?: boolean }>(
          result.config,
          {},
        );
        return config.reproducibility !== "verified" || (!config.manuscriptReady && !result.artifactPath);
      })
      .map<OpeningAction>((result) => ({
        id: `result-${result.id}`,
        title: result.title,
        href: "/data?manuscript=not-ready",
        kind: "结果",
        detail: result.experiment?.title ?? result.dataset?.name ?? "未关联来源",
        action: "补证据缺口",
        rank: 8,
      })),
    ...stalePapers.map<OpeningAction>((paper) => ({
      id: `paper-${paper.id}`,
      title: paper.title,
      href: `/papers?status=${paper.readStatus}`,
      kind: "文献",
      detail: `${ageText(paper.updatedAt)}未处理 · ${statusLabel(paper.readStatus)}`,
      action: "收口阅读",
      rank: 9,
    })),
    ...recentPapers
      .filter((paper) => ["unread", "reading"].includes(paper.readStatus))
      .map<OpeningAction>((paper) => ({
        id: `paper-${paper.id}`,
        title: paper.title,
        href: `/papers?status=${paper.readStatus}`,
        kind: "文献",
        detail: `${paper.year ?? "年份未知"} · ${statusLabel(paper.readStatus)}`,
        action: paper.readStatus === "reading" ? "继续阅读" : "启动阅读",
        rank: 12,
      })),
  ]).slice(0, 3);
  const focusAction = openingActions[0];

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
              {focusAction?.title ?? focusItem?.title ?? "先建立第一条任务或实验记录"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              {focusAction
                ? `${focusAction.kind} · ${focusAction.detail}。建议动作：${focusAction.action}。先完成这一件，再去对应模块细看。`
                : "当前还没有可排序的任务、事务、实验、结果或文献。先用快速捕捉写下一件真实要做的事，首页就会开始帮你收口。"}
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
              {openingActions.length ? (
                openingActions.map((item, index) => (
                  <FocusStackItem
                    key={item.id}
                    index={`0${index + 1}`}
                    title={item.title}
                    detail={`${item.kind} · ${item.action}`}
                    href={item.href}
                  />
                ))
              ) : (
                <FocusStackItem
                  index="01"
                  title="写下第一件要做的事"
                  detail="快速捕捉即可开始"
                />
              )}
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
        next={focusAction?.title ?? focusItem?.title ?? "先建立第一条任务"}
        paper={`${readingPapers + unreadPapers} 篇待处理`}
        experiment={`${runningExperiments} 个进行中`}
        evidence={`${manuscriptReady} 条可写入`}
      />

      <DailyChecklistHub
        candidates={dailyChecklistCandidates}
        currentDailyPlan={currentDailyPlan}
        currentTodayMeetingBrief={currentTodayMeetingBrief}
      />

      <StarterProgress counts={workspaceCounts} guideNote={currentFirstRunGuide} />

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

function FirstRunDashboard({ guideNote }: { guideNote: GuideNoteSummary | null }) {
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
              {guideNote ? (
                <Link className={buttonVariants({ variant: "default" })} href={`/notes?note=${guideNote.id}`}>
                  <FileText className="size-4" />
                  打开上手清单
                </Link>
              ) : (
                <form action={createFirstRunGuideNote}>
                  <SubmitButton variant="default">
                    <FileText className="size-4" />
                    生成上手清单
                  </SubmitButton>
                </form>
              )}
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
                {guideNote ? (
                  <FirstRunStep
                    index="01"
                    title="打开 10 分钟上手清单"
                    detail={`已生成，更新 ${formatDateTime(guideNote.updatedAt)}。继续按清单完成真实数据。`}
                    href={`/notes?note=${guideNote.id}`}
                  />
                ) : (
                  <FirstRunStep
                    index="01"
                    title="生成 10 分钟上手清单"
                    detail="先得到一篇可勾选路线图，之后在笔记里继续改。"
                    action={createFirstRunGuideNote}
                  />
                )}
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
        next="写第一条真实记录"
        paper="同步 Zotero"
        experiment="建当前课题"
        evidence="晚上再收口"
      />

      <section className="rounded-2xl border border-border/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,246,0.78))] p-4 shadow-[0_12px_28px_rgba(27,42,56,0.04)]">
        <div className="grid gap-4 xl:grid-cols-[0.36fr_0.64fr] xl:items-center">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold hero-title">
              <Lightbulb className="size-4 text-primary" />
              先写第一条真实记录
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              不确定先填哪个模块时，直接用一句话捕捉。示例会先填入输入框，确认后再提交。
            </p>
          </div>
          <QuickCaptureBar />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StartCard
          icon={NotebookPen}
          title="第一条真实记录"
          detail="先写导师反馈、实验观察、结果数字或一个想法。"
          href="/notes?mode=new"
          action="写一条"
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
          icon={Settings}
          title="可选连接"
          detail="需要同步或生成草稿时，再填 Zotero / AI Key。"
          href="/settings"
          action="去设置"
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
            <ChecklistRow
              title={guideNote ? "上手清单已生成，继续完成真实数据" : "先生成一篇 10 分钟上手清单"}
              detail={
                guideNote
                  ? "上手清单不会再把首页误判为已完成开箱；真正开始以后再进入日常指挥台。"
                  : "清单只是路线图，不算正式数据。生成后首页仍会保留开箱引导。"
              }
            />
            <ChecklistRow title="留下第一条能复盘的记录" detail="实验目的、阅读摘录、组会提醒，任选一个。" />
            <ChecklistRow title="把一个真实课题放进去" detail="不要搬历史资料，先放当前正在推进的题目。" />
            <ChecklistRow title="按需连接 Zotero 或 AI" detail="需要同步文献或生成草稿时，再去设置中心填 Key。" />
          </CardContent>
        </Card>

        <Card className="workbench-card overflow-hidden">
          <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4 text-primary" />
              暂时不用做
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <DoNotDoRow title="不搬旧资料" detail="PDF、历史实验和旧表格先留在原处，今天只处理当前研究流。" />
            <DoNotDoRow title="不堆配置项" detail="Zotero、AI 和访问密码按需设置，数据库和端口留给部署文件。" />
            <DoNotDoRow title="不追求一次完美" detail="先真实使用一周，再决定要不要补迁移、图谱或高级集成。" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function DailyChecklistHub({
  candidates,
  currentDailyPlan,
  currentTodayMeetingBrief,
}: {
  candidates: {
    experiments: ChecklistCandidate[];
    notes: ChecklistCandidate[];
    papers: ChecklistCandidate[];
    results: ChecklistCandidate[];
    tasks: ChecklistCandidate[];
  };
  currentDailyPlan: GuideNoteSummary | null;
  currentTodayMeetingBrief: GuideNoteSummary | null;
}) {
  return (
    <section className="rounded-2xl border border-border/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(241,247,249,0.8))] p-3 shadow-[0_12px_28px_rgba(27,42,56,0.036)]">
      <div className="grid gap-3 xl:grid-cols-[0.33fr_0.67fr] xl:items-stretch">
        <div className="grid gap-3 rounded-xl border border-white/72 bg-white/64 p-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold hero-title">
              <Sparkles className="size-4 text-primary" />
              3 分钟自动整理
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              不翻长列表。每天只生成会用到的计划、导师沟通单和跨模块收口清单。
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {currentDailyPlan ? (
              <Link
                className={buttonVariants({ variant: "default" })}
                href={`/notes?note=${currentDailyPlan.id}`}
              >
                <FileText className="size-4" />
                打开今日计划
              </Link>
            ) : (
              <form action={createDailyPlanNote}>
                <SubmitButton variant="default" className="w-full justify-start">
                  <FileText className="size-4" />
                  生成今日计划
                </SubmitButton>
              </form>
            )}
            {currentTodayMeetingBrief ? (
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`/notes?note=${currentTodayMeetingBrief.id}`}
              >
                <CalendarClock className="size-4" />
                打开导师沟通单
              </Link>
            ) : (
              <form action={createMeetingBriefNote}>
                <input type="hidden" name="scope" value="today" />
                <SubmitButton variant="outline" className="w-full justify-start bg-white/74">
                  <CalendarClock className="size-4" />
                  生成导师沟通单
                </SubmitButton>
              </form>
            )}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <ChecklistActionCard
            action={createProjectProgressNote}
            buttonText="生成三项"
            detail="课题下一步"
            emptyText="先加任务"
            href="/projects?scope=today"
            icon={FolderKanban}
            ids={candidates.tasks}
            returnTo="/projects?scope=today"
            title="课题推进"
          />
          <ChecklistActionCard
            action={createReadingPlanNote}
            buttonText="生成三篇"
            detail="Zotero 阅读"
            emptyText="先同步文献"
            href="/papers"
            icon={BookOpenText}
            ids={candidates.papers}
            returnTo="/papers"
            title="文献启动"
          />
          <ChecklistActionCard
            action={createExperimentCloseoutNote}
            buttonText="生成收口"
            detail="实验观察/结论"
            emptyText="先记录实验"
            href="/experiments"
            icon={FlaskConical}
            ids={candidates.experiments}
            title="实验收口"
          />
          <ChecklistActionCard
            action={createResultCloseoutNote}
            buttonText="生成证据"
            detail="复现/图表素材"
            emptyText="先登记结果"
            href="/data"
            icon={FileChartColumn}
            ids={candidates.results}
            title="结果证据"
          />
          <ChecklistActionCard
            action={createNoteCloseoutNote}
            buttonText="生成沉淀"
            detail="笔记转写作"
            emptyText="先写笔记"
            href="/notes"
            icon={PenLine}
            ids={candidates.notes}
            title="笔记沉淀"
          />
        </div>
      </div>
    </section>
  );
}

function ChecklistActionCard({
  action,
  buttonText,
  detail,
  emptyText,
  href,
  icon: Icon,
  ids,
  returnTo,
  title,
}: {
  action: (formData: FormData) => Promise<void>;
  buttonText: string;
  detail: string;
  emptyText: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  ids: ChecklistCandidate[];
  returnTo?: string;
  title: string;
}) {
  const disabled = ids.length === 0;

  return (
    <div className="grid min-h-36 gap-3 rounded-xl border border-border/65 bg-white/74 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
      <Link href={href} className="group grid gap-2">
        <span className="flex items-start justify-between gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl border border-[#d8e5ee] bg-[#eef4fb] text-[#365a7d] transition group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="size-4" />
          </span>
          <span className="rounded-full border border-border/70 bg-white/72 px-2 py-0.5 text-[11px] text-muted-foreground">
            {ids.length ? `${ids.length} 项` : "空"}
          </span>
        </span>
        <span>
          <span className="block text-sm font-semibold hero-title">{title}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
          <span className="mt-2 block line-clamp-1 text-xs text-muted-foreground">
            {ids[0]?.title ?? emptyText}
          </span>
        </span>
      </Link>
      <form action={action} className="mt-auto">
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        {ids.map((item) => (
          <input key={item.id} type="hidden" name="ids" value={item.id} />
        ))}
        <SubmitButton
          variant="outline"
          className="h-8 w-full justify-center bg-white/74 px-2.5 text-xs"
          disabled={disabled}
        >
          <FileText className="size-3.5" />
          {disabled ? emptyText : buttonText}
        </SubmitButton>
      </form>
    </div>
  );
}

function StarterProgress({
  counts,
  guideNote,
}: {
  counts: WorkspaceCounts;
  guideNote: GuideNoteSummary | null;
}) {
  const steps = [
    {
      done: Boolean(guideNote),
      icon: FileText,
      title: "上手清单",
      detail: guideNote ? `已生成，更新 ${formatDateTime(guideNote.updatedAt)}` : "先生成一篇可勾选路线图",
      href: guideNote ? `/notes?note=${guideNote.id}` : undefined,
      action: createFirstRunGuideNote,
      actionLabel: guideNote ? "打开清单" : "生成清单",
    },
    {
      done: counts.papers > 0,
      icon: BookOpenText,
      title: "文献入口",
      detail: counts.papers ? `${counts.papers} 篇文献已进入阅读队列` : "同步 Zotero 或补一篇临时文献",
      href: "/papers",
      actionLabel: counts.papers ? "看文献" : "去同步",
    },
    {
      done: counts.projects > 0 || counts.tasks > 0,
      icon: FolderKanban,
      title: "课题主线",
      detail:
        counts.projects || counts.tasks
          ? `${counts.projects} 个课题，${counts.tasks} 个任务`
          : "建一个正在推进的课题和 1-3 个任务",
      href: "/projects",
      actionLabel: counts.projects || counts.tasks ? "看课题" : "建课题",
    },
    {
      done: counts.experiments + counts.notes + counts.results > 0,
      icon: FlaskConical,
      title: "研究记录",
      detail:
        counts.experiments + counts.notes + counts.results
          ? `${counts.experiments} 条实验，${counts.results} 条结果，${counts.notes} 篇笔记`
          : "留下第一条实验、结果或笔记",
      href: counts.experiments ? "/experiments" : "/notes?mode=new",
      actionLabel: counts.experiments + counts.notes + counts.results ? "继续记录" : "写一条",
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  if (doneCount === steps.length || (counts.substantive > 8 && doneCount >= 3)) {
    return null;
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-border/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,247,247,0.76))] p-3 shadow-[0_10px_24px_rgba(27,42,56,0.032)]">
      <div className="grid gap-3 lg:grid-cols-[1fr_18rem] lg:items-center">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold hero-title">
            <CircleCheck className="size-4 text-primary" />
            启动进度
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            这不是配置清单，只确认工作台有没有接住真实科研流。完成后这里会自动消失。
          </p>
        </div>
        <div className="rounded-xl border border-white/72 bg-white/64 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>开箱完成度</span>
            <span className="font-medium hero-title">{doneCount}/{steps.length}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#365a7d]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => (
          <StarterStepCard key={step.title} {...step} />
        ))}
      </div>
    </section>
  );
}

function StarterStepCard({
  action,
  actionLabel,
  detail,
  done,
  href,
  icon: Icon,
  title,
}: {
  action?: () => Promise<void>;
  actionLabel: string;
  detail: string;
  done: boolean;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={
            done
              ? "flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#d8e5ee] bg-[#eef4fb] text-[#365a7d]"
          }
        >
          <Icon className="size-4" />
        </span>
        <span
          className={
            done
              ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
              : "rounded-full border bg-white px-2 py-0.5 text-[11px] text-muted-foreground"
          }
        >
          {done ? "已完成" : "待处理"}
        </span>
      </div>
      <span>
        <span className="block font-semibold hero-title">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span>
      </span>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
        {actionLabel}
        <ArrowRight className="size-3.5" />
      </span>
    </>
  );
  const className =
    "grid h-full gap-3 rounded-xl border border-border/70 bg-white/74 p-3 text-left transition hover:border-primary/25 hover:bg-white hover:shadow-[0_10px_24px_rgba(27,42,56,0.05)]";

  if (!href && action) {
    return (
      <form action={action}>
        <button type="submit" className={className}>
          {body}
        </button>
      </form>
    );
  }

  return (
    <Link href={href ?? "/"} className={className}>
      {body}
    </Link>
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

function DoNotDoRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-dashed border-[#d9e3dc] bg-white/60 p-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#f7f1df] text-[#7a5a2f]">
        <CircleCheck className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-medium hero-title">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
}

function FocusStackItem({
  index,
  title,
  detail,
  href,
}: {
  index: string;
  title: string;
  detail: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-white/45">{index}</span>
        <span className="h-px flex-1 bg-white/12" />
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 line-clamp-1 text-xs text-white/58">{detail}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-xl border border-white/10 bg-white/[0.07] p-3 transition hover:border-white/24 hover:bg-white/[0.12]"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3">
      {content}
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
      label: "开工前",
      value: next,
      detail: "只确认今天最值得推进的一件事",
      href: "/projects?scope=today",
    },
    {
      icon: BookOpenText,
      label: "深度工作",
      value: paper,
      detail: "读关键文献，或把任务转成实验记录",
      href: "/papers",
    },
    {
      icon: FlaskConical,
      label: "收口前",
      value: experiment,
      detail: "补观察、结论、失败复盘和下一步",
      href: "/experiments",
    },
    {
      icon: FileChartColumn,
      label: "组会前",
      value: evidence,
      detail: "把结果证据沉淀成周报或论文素材",
      href: "/data",
    },
  ];

  return (
    <section className="rhythm-band overflow-hidden rounded-2xl border px-3 py-3">
      <div className="flex flex-col gap-2 px-1 pb-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold hero-title">
            <TimerReset className="size-4 text-primary" />
            今日研究流
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            按一天真实节奏组织，不让文献、实验、结果和周报散在不同页面里。
          </p>
        </div>
        <span className="w-fit rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
          轻量顺序 · 可随时跳转
        </span>
      </div>
      <div className="rhythm-rail grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="rhythm-step group relative grid gap-3 rounded-xl border border-border/55 bg-white/72 p-3 transition hover:border-primary/25 hover:bg-white sm:grid-cols-[auto_1fr] sm:items-start"
            >
              <span className="rhythm-node flex size-9 items-center justify-center rounded-xl bg-[#eef4fb] text-[#365a7d] transition group-hover:bg-primary group-hover:text-primary-foreground">
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
            </Link>
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
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <span className="w-fit rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
            {items.length ? `${items.length} 项需要看一眼` : "状态稳定"}
          </span>
          <form action={createClosingReviewNote}>
            <SubmitButton variant="outline" className="h-8 px-2.5 text-xs">
              <TimerReset className="size-3.5" />
              生成收口清单
            </SubmitButton>
          </form>
        </div>
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
  const counts = [
    { kind: "文献", label: "文献", value: items.filter((item) => item.kind === "文献").length },
    { kind: "实验", label: "实验", value: items.filter((item) => item.kind === "实验").length },
    { kind: "结果", label: "结果", value: items.filter((item) => item.kind === "结果").length },
    { kind: "笔记", label: "笔记", value: items.filter((item) => item.kind === "笔记").length },
  ];

  return (
    <Card className="workbench-card overflow-hidden">
      <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" />
            研究时间线
          </CardTitle>
          <Link href="/notes?folder=组会" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
            整理成周报
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.length ? (
          <>
            <div className="grid gap-2 sm:grid-cols-4">
              {counts.map((count) => (
                <div
                  key={count.kind}
                  className="rounded-xl border border-border/60 bg-white/66 px-3 py-2"
                >
                  <p className="text-[11px] font-medium text-muted-foreground">{count.label}</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight hero-title">{count.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border/62 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,251,252,0.76))] px-3 py-2">
              {items.map((item, index) => {
                const Icon = timelineIcon(item.tone);

                return (
                  <Link
                    key={`${item.tone}-${item.id}`}
                    href={item.href}
                    className="group grid gap-3 border-b border-border/54 py-3 transition last:border-b-0 hover:bg-white/58 sm:grid-cols-[2.75rem_1fr_auto] sm:items-start"
                  >
                    <span className="relative hidden justify-center sm:flex">
                      {index < items.length - 1 ? (
                        <span className="absolute left-1/2 top-10 h-[calc(100%+0.75rem)] w-px -translate-x-1/2 bg-border/68" />
                      ) : null}
                      <span className={timelineIconClass(item.tone)}>
                        <Icon className="size-4" />
                      </span>
                    </span>
                    <span className="min-w-0 space-y-1.5">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className={timelineKindClass(item.tone)}>{item.kind}</span>
                        <span className="line-clamp-1 font-medium">{item.title}</span>
                      </span>
                      <span className="block line-clamp-1 text-xs text-muted-foreground">
                        {item.meta}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground sm:hidden">
                        <span>{formatDateTime(item.updatedAt)}</span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/35" />
                        <span>{timelineAction(item.tone)}</span>
                      </span>
                    </span>
                    <span className="hidden min-w-28 flex-col items-end gap-1.5 sm:flex">
                      <span className="text-xs font-medium text-muted-foreground group-hover:text-primary">
                        {formatDateTime(item.updatedAt)}
                      </span>
                      <span className="rounded-full border border-white/80 bg-white/78 px-2.5 py-1 text-[11px] font-medium text-[#365a7d]">
                        {timelineAction(item.tone)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="rounded-xl border border-dashed border-[#cfe0df] bg-white/58 px-3 py-2 text-xs leading-5 text-muted-foreground">
              这不是新的日志系统，只把最近的文献、实验、结果和笔记串起来。组会或周报前，先从这里回看本周研究脉络。
            </div>
          </>
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

function timelineKindClass(tone: TimelineItem["tone"]) {
  const classes = {
    paper: "rounded-md border border-[#d8e5ee] bg-[#eef3fb] px-1.5 py-0.5 text-[11px] font-medium text-[#365a7d]",
    experiment: "rounded-md border border-[#cfe0df] bg-[#eef7f3] px-1.5 py-0.5 text-[11px] font-medium text-[#2f6655]",
    result: "rounded-md border border-[#eadfbf] bg-[#f7f1df] px-1.5 py-0.5 text-[11px] font-medium text-[#7a5a2f]",
    note: "rounded-md border border-[#ded5e8] bg-[#f3eef9] px-1.5 py-0.5 text-[11px] font-medium text-[#5d4d80]",
  };

  return classes[tone];
}

function timelineAction(tone: TimelineItem["tone"]) {
  const actions = {
    paper: "沉淀阅读",
    experiment: "收口观察",
    result: "进入周报",
    note: "继续写作",
  };

  return actions[tone];
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
    paper: "relative z-10 flex size-9 items-center justify-center rounded-xl bg-[#eef3fb] text-primary ring-4 ring-white/80",
    experiment: "relative z-10 flex size-9 items-center justify-center rounded-xl bg-[#eef7f3] text-[#2f6655] ring-4 ring-white/80",
    result: "relative z-10 flex size-9 items-center justify-center rounded-xl bg-[#f7f1df] text-[#7a5a2f] ring-4 ring-white/80",
    note: "relative z-10 flex size-9 items-center justify-center rounded-xl bg-[#f3eef9] text-[#5d4d80] ring-4 ring-white/80",
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

function uniqueOpeningActions(items: OpeningAction[]) {
  const seen = new Set<string>();

  return [...items]
    .sort((left, right) => {
      const rank = left.rank - right.rank;
      if (rank !== 0) return rank;

      return left.title.localeCompare(right.title, "zh-CN");
    })
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function openingDueRank(value: Date | null) {
  const distance = daysUntil(value);
  if (distance === null) return 20;
  if (distance < 0) return -10 + distance;
  if (distance === 0) return -5;
  return Math.min(distance, 14);
}

function priorityBias(priority: string) {
  const bias: Record<string, number> = {
    high: -1.2,
    medium: 0,
    low: 1,
  };

  return bias[priority] ?? 0;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function toChecklistCandidate(item: { id: string; title?: string; name?: string }) {
  return {
    id: item.id,
    title: item.title ?? item.name ?? "未命名条目",
  };
}
