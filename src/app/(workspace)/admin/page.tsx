import {
  AlertCircle,
  CalendarClock,
  ClipboardList,
  Clock3,
  Edit3,
  FileCheck2,
  FileText,
  Inbox,
  MapPin,
  MessageSquareText,
  Plus,
  ReceiptText,
  Search,
  Sparkles,
  Trash2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { AdminItem, Note, Prisma } from "@prisma/client";

import {
  createMeetingFeedbackNote,
  createMeetingBriefNote,
  createAdminItem,
  createTasksFromNoteChecklist,
  deleteAdminItem,
  setAdminStatus,
  updateAdminItem,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { daysUntil, formatDate, formatDateTime, parseTags } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { CaptureNotice } from "@/components/shared/capture-notice";
import { CreateDialog } from "@/components/shared/create-dialog";
import { Field } from "@/components/shared/field";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getMeetingBriefPeriod } from "@/lib/meeting-brief";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; type?: string; status?: string; scope?: string; captured?: string }>;
};

const itemTypes = [
  { value: "meeting", label: "组会", icon: UsersRound },
  { value: "material", label: "材料", icon: FileText },
  { value: "reimbursement", label: "报销", icon: ReceiptText },
  { value: "deadline", label: "截止", icon: CalendarClock },
] as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type AdminFilters = {
  q?: string;
  type?: string;
  status?: string;
  scope?: string;
};

type MeetingBriefSummary = {
  id: string;
  updatedAt: Date;
};

type AdvisorPackItem = {
  action: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  id: string;
  label: string;
  title: string;
  tone: "admin" | "experiment" | "paper" | "result" | "task";
};

type AdvisorQuestionItem = {
  action: string;
  context: string;
  href: string;
  icon: LucideIcon;
  id: string;
  question: string;
  rank: number;
  source: string;
  title: string;
  tone: "admin" | "experiment" | "paper" | "result" | "task";
};

type FeedbackLoopNote = Note & {
  openChecklistCount: number;
};

function adminHref(filters: AdminFilters, patch: Partial<AdminFilters>) {
  const merged = { ...filters, ...patch };
  const query = new URLSearchParams();

  if (merged.q) query.set("q", merged.q);
  if (merged.type) query.set("type", merged.type);
  if (merged.status) query.set("status", merged.status);
  if (merged.scope) query.set("scope", merged.scope);

  return query.size ? `/admin?${query.toString()}` : "/admin";
}

export default async function AdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q)?.trim();
  const type = first(params.type);
  const status = first(params.status);
  const now = new Date();
  const meetingBriefPeriod = getMeetingBriefPeriod(now, "week");
  const todayMeetingBriefPeriod = getMeetingBriefPeriod(now, "today");
  const scope = first(params.scope);
  const captured = first(params.captured);
  const currentFilters = { q, type, status, scope };

  const where: Prisma.AdminItemWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { tags: { contains: q, mode: "insensitive" } },
    ];
  }
  if (type && itemTypes.some((item) => item.value === type)) {
    where.type = type;
  }
  if (status && ["todo", "doing", "done"].includes(status)) {
    where.status = status;
  }
  if (scope === "today") {
    const tomorrow = new Date(now);
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    where.dueDate = { lt: tomorrow };
    if (!status) {
      where.status = { not: "done" };
    }
  }

  const [
    items,
    allAdminItems,
    typeCounts,
    statusCounts,
    currentMeetingBrief,
    currentTodayMeetingBrief,
    briefTaskCount,
    briefResultCount,
    briefPaperCount,
    advisorTasks,
    advisorExperiments,
    advisorResults,
    advisorPapers,
    feedbackNotes,
  ] = await Promise.all([
    prisma.adminItem.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.adminItem.findMany({
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.adminItem.groupBy({ by: ["type"], _count: true }),
    prisma.adminItem.groupBy({ by: ["status"], _count: true }),
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
    prisma.task.count({
      where: {
        status: { not: "done" },
        OR: [{ priority: "high" }, { dueDate: { lt: meetingBriefPeriod.endExclusive } }],
      },
    }),
    prisma.result.count({
      where: {
        OR: [{ artifactPath: { not: null } }, { config: { contains: "\"manuscriptReady\":true" } }],
      },
    }),
    prisma.paper.count({
      where: { readStatus: { in: ["unread", "reading"] } },
    }),
    prisma.task.findMany({
      where: {
        status: { not: "done" },
        OR: [{ priority: "high" }, { dueDate: { lt: meetingBriefPeriod.endExclusive } }],
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 3,
      include: { milestone: { include: { project: true } } },
    }),
    prisma.experiment.findMany({
      where: { status: { in: ["running", "failed"] } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: { project: true },
    }),
    prisma.result.findMany({
      where: {
        OR: [{ artifactPath: { not: null } }, { config: { contains: "\"manuscriptReady\":true" } }],
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: { experiment: true, dataset: true },
    }),
    prisma.paper.findMany({
      where: { readStatus: { in: ["unread", "reading"] } },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    prisma.note.findMany({
      where: {
        folder: "组会",
        OR: [
          { title: { contains: "反馈", mode: "insensitive" } },
          { tags: { contains: "导师反馈", mode: "insensitive" } },
          { content: { contains: "导师反馈", mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const allItemsCount = statusCounts.reduce((sum, item) => sum + item._count, 0);
  const doneBaseCount = statusCounts.find((item) => item.status === "done")?._count ?? 0;
  const openBaseItems = allAdminItems.filter((item) => item.status !== "done");
  const openBaseCount = openBaseItems.length;
  const todayBaseCount = openBaseItems.filter((item) => {
    const distance = daysUntil(item.dueDate);
    return distance !== null && distance <= 0;
  }).length;
  const dueTodayBaseCount = openBaseItems.filter((item) => daysUntil(item.dueDate) === 0).length;
  const overdueBaseCount = openBaseItems.filter((item) => {
    const distance = daysUntil(item.dueDate);
    return distance !== null && distance < 0;
  }).length;
  const meetingOpenCount = openBaseItems.filter((item) => item.type === "meeting").length;
  const reimbursementOpenCount = openBaseItems.filter((item) => item.type === "reimbursement").length;
  const materialDeadlineOpenCount = openBaseItems.filter((item) =>
    ["material", "deadline"].includes(item.type),
  ).length;
  const typeCount = (value: string) => typeCounts.find((item) => item.type === value)?._count ?? 0;
  const adminStack = prioritizeAdminRelief(allAdminItems).slice(0, 3);
  const focusItem = adminStack[0];
  const upcomingBaseCount = openBaseItems.filter((item) => {
    const distance = daysUntil(item.dueDate);
    return distance !== null && distance >= 0 && distance <= 7;
  }).length;
  const advisorPackItems: AdvisorPackItem[] = [
    ...advisorTasks.map((task) => ({
      action: "讲下一步",
      detail: `${task.milestone?.project.title ?? task.milestone?.title ?? "独立任务"} · ${dueText(task.dueDate)}`,
      href: "/projects?scope=today",
      icon: ClipboardList,
      id: `task-${task.id}`,
      label: "任务",
      title: task.title,
      tone: "task" as const,
    })),
    ...advisorExperiments.map((experiment) => ({
      action: experiment.status === "failed" ? "讲失败原因" : "讲观察结论",
      detail: `${experiment.project?.title ?? "未关联课题"} · 更新 ${formatDate(experiment.updatedAt)}`,
      href: "/experiments",
      icon: FileCheck2,
      id: `experiment-${experiment.id}`,
      label: "实验",
      title: experiment.title,
      tone: "experiment" as const,
    })),
    ...advisorResults.map((result) => ({
      action: "讲证据",
      detail: `${result.experiment?.title ?? result.dataset?.name ?? "未关联来源"} · 更新 ${formatDate(result.updatedAt)}`,
      href: "/data?manuscript=ready",
      icon: Sparkles,
      id: `result-${result.id}`,
      label: "结果",
      title: result.title,
      tone: "result" as const,
    })),
    ...advisorPapers.map((paper) => ({
      action: "讲输入",
      detail: `${paper.year ?? "年份未知"} · ${paper.category || "未分类"}`,
      href: `/papers?status=${paper.readStatus}`,
      icon: FileText,
      id: `paper-${paper.id}`,
      label: "文献",
      title: paper.title,
      tone: "paper" as const,
    })),
    ...adminStack.map((item) => ({
      action: adminActionLabel(item),
      detail: `${itemTypes.find((type) => type.value === item.type)?.label ?? "事务"} · ${dueText(item.dueDate)}`,
      href: "/admin",
      icon: UsersRound,
      id: `admin-${item.id}`,
      label: "事务",
      title: item.title,
      tone: "admin" as const,
    })),
  ].slice(0, 8);
  const advisorQuestions = [
    briefResultCount
      ? "哪些结果今天可以讲，哪些还缺复现或图表？"
      : "如果还没有可讲结果，今天先汇报哪个实验进展？",
    briefTaskCount
      ? "高优先级任务是否需要导师帮忙判断顺序？"
      : "下周最小计划是否足够具体、可验收？",
    briefPaperCount
      ? "待读/读中文献里有没有值得转成实验的线索？"
      : "是否需要补一篇相关工作或 baseline 文献？",
  ];
  const advisorPrepScore = [
    Boolean(currentTodayMeetingBrief || currentMeetingBrief),
    briefResultCount > 0,
    briefTaskCount > 0,
    meetingOpenCount > 0 || briefPaperCount > 0,
  ].filter(Boolean).length;
  const advisorQuestionItems = prioritizeAdvisorQuestions([
    ...advisorTasks.map<AdvisorQuestionItem>((task) => ({
      action: "去任务",
      context: `${task.milestone?.project.title ?? task.milestone?.title ?? "独立任务"} · ${dueText(task.dueDate)}`,
      href: "/projects?scope=today",
      icon: ClipboardList,
      id: `task-question-${task.id}`,
      question:
        task.priority === "high"
          ? `这个高优先级任务是否应该先做，还是等关键结果出来后再推进？`
          : `这个任务的验收标准是否足够清楚？`,
      rank: task.priority === "high" ? 1 : 4,
      source: "任务",
      title: task.title,
      tone: "task",
    })),
    ...advisorExperiments.map<AdvisorQuestionItem>((experiment) => ({
      action: "去实验",
      context: `${experiment.project?.title ?? "未关联课题"} · ${formatDate(experiment.updatedAt)}`,
      href: "/experiments",
      icon: FileCheck2,
      id: `experiment-question-${experiment.id}`,
      question:
        experiment.status === "failed"
          ? `这个失败现象是否值得继续排查，还是应该换对照/换方案？`
          : `这个进行中的实验下一组对照应该优先补什么？`,
      rank: experiment.status === "failed" ? 2 : 5,
      source: "实验",
      title: experiment.title,
      tone: "experiment",
    })),
    ...advisorResults.map<AdvisorQuestionItem>((result) => ({
      action: "去成果",
      context: `${result.experiment?.title ?? result.dataset?.name ?? "未关联来源"} · ${formatDate(result.updatedAt)}`,
      href: "/data?manuscript=ready",
      icon: Sparkles,
      id: `result-question-${result.id}`,
      question: `这条结果是否已经足够支撑组会/论文里的结论，还是还缺复现或图表？`,
      rank: 3,
      source: "结果",
      title: result.title,
      tone: "result",
    })),
    ...advisorPapers.map<AdvisorQuestionItem>((paper) => ({
      action: "去文献",
      context: `${paper.year ?? "年份未知"} · ${paper.category || "未分类"}`,
      href: `/papers?status=${paper.readStatus}`,
      icon: FileText,
      id: `paper-question-${paper.id}`,
      question: `这篇文献里的方法/对照/指标是否值得转成一个小实验？`,
      rank: 7,
      source: "文献",
      title: paper.title,
      tone: "paper",
    })),
    ...adminStack
      .filter((item) => item.type === "meeting" || item.type === "deadline")
      .map<AdvisorQuestionItem>((item) => ({
        action: "去事务",
        context: `${itemTypes.find((type) => type.value === item.type)?.label ?? "事务"} · ${dueText(item.dueDate)}`,
        href: "/admin",
        icon: UsersRound,
        id: `admin-question-${item.id}`,
        question:
          item.type === "meeting"
            ? `这次沟通最需要导师判断的问题是什么？`
            : `这个截止前是否需要提前确认材料、图表或审批口径？`,
        rank: item.type === "meeting" ? 0 : 6,
        source: "事务",
        title: item.title,
        tone: "admin",
      })),
  ]).slice(0, 5);
  const feedbackLoopNotes: FeedbackLoopNote[] = feedbackNotes.map((note) => ({
    ...note,
    openChecklistCount: openChecklistCount(note.content),
  }));
  const feedbackOpenChecklistCount = feedbackLoopNotes.reduce(
    (sum, note) => sum + note.openChecklistCount,
    0,
  );
  const latestFeedbackNote = feedbackLoopNotes[0] ?? null;
  const feedbackTaskSource = feedbackLoopNotes.find((note) => note.openChecklistCount > 0) ?? null;

  return (
    <div className="grid gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="research-eyebrow">
                <ClipboardList className="size-3.5" />
                组会/周报减负台
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                导师沟通 · 材料 · 报销 · 截止
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              先准备导师要看的内容，再处理那些会打断科研的小事。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              组会、周报、材料和报销，只留今天要处理的。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <CreateDialog
                title="把小事从脑子里移走"
                description="只记录会打断科研节奏的组会、材料、报销和硬截止。"
                label="记一件小事"
                icon={Plus}
                wide
              >
                <AdminItemForm action={createAdminItem} />
              </CreateDialog>
              {currentMeetingBrief ? (
                <Link className={buttonVariants({ variant: "outline" })} href={`/notes?note=${currentMeetingBrief.id}`}>
                  <FileText className="size-4" />
                  继续周报草稿
                </Link>
              ) : (
                <form action={createMeetingBriefNote}>
                  <input type="hidden" name="scope" value="week" />
                  <SubmitButton variant="outline">
                    <FileText className="size-4" />
                    生成周报草稿
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>

          <div className="flex min-h-64 flex-col justify-between rounded-2xl action-stack p-4 text-white shadow-[0_18px_36px_rgba(22,34,53,0.16)]">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-white/68">
                <Clock3 className="size-3.5" />
                今日减负栈
              </p>
              <div className="mt-4 grid gap-2.5">
                {adminStack.length ? (
                  adminStack.map((item, index) => (
                    <AdminStackItem
                      key={item.id}
                      index={`0${index + 1}`}
                      title={item.title}
                      detail={`${adminActionLabel(item)} · ${dueText(item.dueDate)}`}
                    />
                  ))
                ) : (
                  <AdminStackItem
                    index="01"
                    title="暂时没有需要处理的小事"
                    detail="保持科研专注，等有组会或截止再登记"
                  />
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
              <div>
                <p className="text-lg font-semibold tracking-tight">{openBaseCount}</p>
                <p className="mt-0.5 text-[11px] text-white/54">待处理</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{todayBaseCount}</p>
                <p className="mt-0.5 text-[11px] text-white/54">今天/逾期</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{upcomingBaseCount}</p>
                <p className="mt-0.5 text-[11px] text-white/54">7 天内</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="workbench-dual-grid grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
        <aside className="grid content-start gap-4">
          <QuickAdminCapture />

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="size-4 text-primary" />
                现在最该处理
              </CardTitle>
            </CardHeader>
            <CardContent>
              {focusItem ? (
                <div className="soft-tile rounded-xl p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={focusItem.type} />
                    <StatusBadge value={focusItem.status} />
                  </div>
                  <p className="mt-2 font-medium">{focusItem.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{dueText(focusItem.dueDate)}</p>
                  {focusItem.location ? (
                    <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4" />
                      {focusItem.location}
                    </p>
                  ) : null}
                  <p className="mt-3 rounded-lg border border-[#d5e4e8] bg-[#f5fafb] px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {adminActionReason(focusItem)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂时没有待处理事务。</p>
              )}
            </CardContent>
          </Card>

          <Card className="workbench-card overflow-hidden">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="size-4 text-primary" />
                导师沟通准备度
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <AdvisorPrepItem
                index="01"
                label="先有沟通单"
                value={currentTodayMeetingBrief ? "今日已生成" : currentMeetingBrief ? "周报已生成" : "待生成"}
                detail={
                  currentTodayMeetingBrief
                    ? `覆盖今天，可直接用于临时碰导师或会前 5 分钟准备。`
                    : currentMeetingBrief
                      ? `覆盖 ${meetingBriefPeriod.shortLabel}，可继续压缩成 5 分钟版本。`
                      : "先自动整理任务、实验、结果、文献和阻塞，别从空白文档开始。"
                }
                done={Boolean(currentTodayMeetingBrief || currentMeetingBrief)}
              />
              <AdvisorPrepItem
                index="02"
                label="再看证据"
                value={`${briefResultCount} 条结果`}
                detail={`${briefTaskCount} 个高优先级/临近任务，可和结果证据一起决定下周动作。`}
                done={briefResultCount > 0}
              />
              <AdvisorPrepItem
                index="03"
                label="最后列问题"
                value={`${meetingOpenCount} 件组会事`}
                detail={`${briefPaperCount} 篇待读/读中文献可补到“需要导师确认”的讨论里。`}
                done={meetingOpenCount > 0 || briefPaperCount > 0}
              />
              <div className="mt-1 flex flex-wrap gap-2 border-t border-border/65 pt-3">
                {currentTodayMeetingBrief ? (
                  <Link
                    className={buttonVariants({ variant: "default", size: "sm" })}
                    href={`/notes?note=${currentTodayMeetingBrief.id}`}
                  >
                    <FileText className="size-3.5" />
                    今日沟通单
                  </Link>
                ) : (
                  <form action={createMeetingBriefNote}>
                    <input type="hidden" name="scope" value="today" />
                    <SubmitButton variant="default" size="sm">
                      <FileText className="size-3.5" />
                      今日沟通单
                    </SubmitButton>
                  </form>
                )}
                {currentMeetingBrief ? (
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/notes?note=${currentMeetingBrief.id}`}
                  >
                    <FileText className="size-3.5" />
                    打开草稿
                  </Link>
                ) : (
                  <form action={createMeetingBriefNote}>
                    <input type="hidden" name="scope" value="week" />
                    <SubmitButton variant="outline" size="sm">
                      <FileText className="size-3.5" />
                      生成草稿
                    </SubmitButton>
                  </form>
                )}
                <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/notes?folder=组会">
                  看组会笔记
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                减负雷达
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <AdminReliefRadarItem
                icon={AlertCircle}
                label="今天/逾期"
                value={`${dueTodayBaseCount + overdueBaseCount} 件`}
                detail="先收口硬截止，别让小事继续打断科研。"
                href={adminHref(currentFilters, { q: undefined, type: undefined, status: undefined, scope: "today" })}
                tone={dueTodayBaseCount + overdueBaseCount ? "warm" : "quiet"}
              />
              <AdminReliefRadarItem
                icon={UsersRound}
                label="组会准备"
                value={`${meetingOpenCount} 件`}
                detail="组会会牵动任务、实验和结果，优先准备可汇报材料。"
                href={adminHref(currentFilters, { q: undefined, type: "meeting", status: undefined, scope: undefined })}
                tone={meetingOpenCount ? "blue" : "quiet"}
              />
              <AdminReliefRadarItem
                icon={ReceiptText}
                label="报销材料"
                value={`${reimbursementOpenCount} 件`}
                detail="票据、单号和缺项先收住，之后不用反复翻聊天记录。"
                href={adminHref(currentFilters, {
                  q: undefined,
                  type: "reimbursement",
                  status: undefined,
                  scope: undefined,
                })}
                tone={reimbursementOpenCount ? "green" : "quiet"}
              />
              <AdminReliefRadarItem
                icon={FileCheck2}
                label="材料/截止"
                value={`${materialDeadlineOpenCount} 件`}
                detail="材料入口、格式和提交对象先写清楚，减少临时返工。"
                href={adminHref(currentFilters, { q: undefined, type: undefined, status: "todo", scope: undefined })}
                tone={materialDeadlineOpenCount ? "blue" : "quiet"}
              />
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Search className="size-4 text-primary" />
                快捷视图
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <QuickAdminLink
                label="全部事务"
                count={allItemsCount}
                href={adminHref(currentFilters, { type: undefined, status: undefined, scope: undefined })}
                active={!type && !status && !scope}
              />
              <QuickAdminLink
                label="今天/逾期"
                count={todayBaseCount}
                href={adminHref(currentFilters, { type: undefined, status: undefined, scope: "today" })}
                active={scope === "today" && !type && !status}
              />
              <QuickAdminLink
                label="组会"
                count={typeCount("meeting")}
                href={adminHref(currentFilters, { type: "meeting", status: undefined, scope: undefined })}
                active={type === "meeting" && !status && !scope}
              />
              <QuickAdminLink
                label="材料"
                count={typeCount("material")}
                href={adminHref(currentFilters, { type: "material", status: undefined, scope: undefined })}
                active={type === "material" && !status && !scope}
              />
              <QuickAdminLink
                label="报销"
                count={typeCount("reimbursement")}
                href={adminHref(currentFilters, { type: "reimbursement", status: undefined, scope: undefined })}
                active={type === "reimbursement" && !status && !scope}
              />
              <QuickAdminLink
                label="待处理"
                count={openBaseCount}
                href={adminHref(currentFilters, { type: undefined, status: "todo", scope: undefined })}
                active={status === "todo" && !type && !scope}
              />
              <QuickAdminLink
                label="已完成"
                count={doneBaseCount}
                href={adminHref(currentFilters, { type: undefined, status: "done", scope: undefined })}
                active={status === "done" && !type && !scope}
              />
            </CardContent>
          </Card>
        </aside>

        <div className="workbench-column stretch-panel gap-3">
          <CaptureNotice kind={captured} />

          <AdvisorFiveMinutePack
            currentMeetingBrief={currentMeetingBrief}
            currentTodayMeetingBrief={currentTodayMeetingBrief}
            items={advisorPackItems}
            periodLabel={meetingBriefPeriod.shortLabel}
            questions={advisorQuestions}
            score={advisorPrepScore}
          />

          <AdvisorQuestionQueue questions={advisorQuestionItems} />

          <AdvisorFeedbackLoop
            feedbackOpenChecklistCount={feedbackOpenChecklistCount}
            feedbackTaskSource={feedbackTaskSource}
            latestFeedbackNote={latestFeedbackNote}
            notes={feedbackLoopNotes}
          />

          <section className="grid gap-3 rounded-2xl border border-border/65 bg-white/74 p-3 shadow-[0_12px_30px_rgba(27,42,56,0.045)]">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold hero-title">
                  <Clock3 className="size-4 text-primary" />
                  三件事务减负
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  从全库事务里优先挑 3 件最该处理的小事，不受当前筛选影响。先处理逾期、今天截止、组会和进行中事项。
                </p>
              </div>
              <span className="w-fit rounded-full border border-[#d5e4e8] bg-[#eef6f4] px-2.5 py-1 text-xs font-medium text-[#315266]">
                全库待处理 {openBaseCount} 件
              </span>
            </div>
            {adminStack.length ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {adminStack.map((item, index) => (
                  <AdminReliefCard key={item.id} item={item} index={index + 1} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="暂时没有需要收口的小事"
                description="没有待处理事务时，优先回到文献、实验和结果主线。"
              />
            )}
          </section>

          <form className="grid gap-2 rounded-2xl border border-border/72 bg-white/88 p-3 shadow-[0_12px_28px_rgba(27,42,56,0.045)] md:grid-cols-[1fr_150px_150px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="搜索事务、地点、备注、标签"
                defaultValue={q}
                className="pl-8"
              />
            </div>
            <select
              name="type"
              defaultValue={type ?? ""}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部类型</option>
              {itemTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部状态</option>
              <option value="todo">待办</option>
              <option value="doing">进行中</option>
              <option value="done">完成</option>
            </select>
            <Button type="submit" variant="outline">
              筛选
            </Button>
          </form>

          {items.length ? (
            <div className="grid flex-1 content-start gap-3">
              {items.map((item) => (
                <AdminTimelineCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="暂无轻事务"
              description="把组会、材料和报销先收进减负栈，首页会自动汇总近期事项。"
            />
          )}
        </div>
      </section>
    </div>
  );
}

function AdminStackItem({
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
        <span className="font-mono text-[11px] font-semibold text-white/50">{index}</span>
        <span className="h-px flex-1 bg-white/12" />
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 line-clamp-1 text-xs text-white/58">{detail}</p>
    </div>
  );
}

function QuickAdminCapture() {
  return (
    <Card className="workbench-card border-primary/12 bg-[linear-gradient(135deg,rgba(239,247,247,0.94),rgba(255,250,238,0.76))]">
      <CardHeader className="border-b border-white/70 bg-white/38 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Inbox className="size-4 text-primary" />
          30 秒登记小事
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createAdminItem} className="grid gap-3">
          <Field label="要处理什么">
            <Input
              name="title"
              required
              placeholder="例如：周五组会补两张结果图"
              className="h-10 border-[#cadbe1] bg-white/92 font-medium"
            />
          </Field>

          <input type="hidden" name="status" value="todo" />
          <input type="hidden" name="tags" value="快速事务" />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="类型">
              <select
                name="type"
                defaultValue="meeting"
                className="h-9 rounded-lg border border-[#d4e0e5] bg-white/90 px-2 text-sm outline-none transition focus:border-primary/40 focus:ring-3 focus:ring-ring/18"
              >
                {itemTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="截止">
              <Input name="dueDate" type="date" className="h-9 border-[#d4e0e5] bg-white/90" />
            </Field>
          </div>

          <Field label="地点 / 渠道">
            <Input
              name="location"
              placeholder="会议室 / 微信群 / 学院系统"
              className="h-9 border-[#d4e0e5] bg-white/90"
            />
          </Field>

          <Textarea
            name="notes"
            rows={3}
            placeholder={"入口/地点：\n缺什么："}
            className="min-h-24 resize-none border-[#d4e0e5] bg-white/90 text-sm leading-6"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d5e4e8] bg-white/58 px-3 py-2">
            <p className="text-xs leading-5 text-muted-foreground">
              先收住小事，处理完就回科研主线。
            </p>
            <SubmitButton className="w-fit">加入减负栈</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function QuickAdminLink({
  label,
  count,
  href,
  active,
}: {
  label: string;
  count: number;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "flex items-center justify-between rounded-xl border border-primary/25 bg-[#eef4fb] px-3 py-2 text-sm font-medium text-primary"
          : "flex items-center justify-between soft-tile rounded-xl px-3 py-2 text-sm transition hover:border-primary/25 hover:bg-white"
      }
    >
      <span>{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </Link>
  );
}

function openChecklistCount(content: string) {
  return content
    .split("\n")
    .filter((line) => /^\s*[-*]\s+\[\s\]\s+.+/.test(line))
    .filter((line) => !content.includes(noteTaskMarkerKey(line)))
    .length;
}

function noteTaskMarkerKey(line: string) {
  const title = line
    .replace(/^\s*[-*]\s+\[\s\]\s+/, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
  let hash = 0;
  for (let index = 0; index < title.length; index += 1) {
    hash = (hash * 31 + title.charCodeAt(index)) >>> 0;
  }
  return `:${hash.toString(36)} -->`;
}

function AdvisorPrepItem({
  index,
  label,
  value,
  detail,
  done,
}: {
  index: string;
  label: string;
  value: string;
  detail: string;
  done: boolean;
}) {
  return (
    <div
      className={
        done
          ? "rounded-xl border border-[#cfe0e4] bg-[#eef7f4] p-3"
          : "rounded-xl border border-border/70 bg-white/76 p-3"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-muted-foreground">{index}</span>
          <span className="text-sm font-medium">{label}</span>
        </span>
        <span className={done ? "text-xs font-medium text-[#2f6655]" : "text-xs font-medium text-primary"}>
          {value}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function AdminReliefRadarItem({
  icon: Icon,
  label,
  value,
  detail,
  href,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  href: string;
  tone?: "blue" | "warm" | "green" | "quiet";
}) {
  const toneClass = {
    blue: "border-[#d5e4e8] bg-[#eef6f7] text-primary",
    warm: "border-[#edd8a5] bg-[#fff7df] text-[#7a5a2f]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    quiet: "border-border/70 bg-white/72 text-muted-foreground",
  }[tone];

  return (
    <Link
      href={href}
      className="group grid gap-2 rounded-xl border border-border/70 bg-white/74 p-2.5 transition hover:border-primary/25 hover:bg-white"
    >
      <span className="flex items-start gap-2">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${toneClass}`}>
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs font-medium text-primary">{value}</span>
          </span>
          <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">
            {detail}
          </span>
        </span>
      </span>
    </Link>
  );
}

function AdvisorFiveMinutePack({
  currentMeetingBrief,
  currentTodayMeetingBrief,
  items,
  periodLabel,
  questions,
  score,
}: {
  currentMeetingBrief: MeetingBriefSummary | null;
  currentTodayMeetingBrief: MeetingBriefSummary | null;
  items: AdvisorPackItem[];
  periodLabel: string;
  questions: string[];
  score: number;
}) {
  const briefHref = currentTodayMeetingBrief
    ? `/notes?note=${currentTodayMeetingBrief.id}`
    : currentMeetingBrief
      ? `/notes?note=${currentMeetingBrief.id}`
      : null;

  return (
    <section className="advisor-pack overflow-hidden rounded-3xl border border-border/60 p-4 shadow-[0_18px_42px_rgba(27,42,56,0.055)]">
      <div className="grid gap-4 xl:grid-cols-[0.38fr_0.62fr]">
        <div className="advisor-pack-lead rounded-2xl border border-white/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="research-eyebrow">
              <UsersRound className="size-3.5" />
              会前 5 分钟
            </span>
            <span className="rounded-full border border-white/72 bg-white/68 px-2.5 py-1 text-xs font-medium text-primary">
              准备度 {score}/4
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight hero-title">
            先把能讲的内容收成一页，再去见导师。
          </h2>
          <p className="mt-3 text-sm leading-6 hero-copy">
            这里不是事务后台。它把近期任务、实验、结果、文献和小事压缩成会前沟通包，
            让你先讲结论、证据和需要导师判断的问题。
          </p>

          <div className="mt-4 grid gap-2">
            {briefHref ? (
              <Link className={buttonVariants({ variant: "default" })} href={briefHref}>
                <FileText className="size-4" />
                {currentTodayMeetingBrief ? "打开今日沟通单" : "继续周报草稿"}
              </Link>
            ) : (
              <form action={createMeetingBriefNote}>
                <input type="hidden" name="scope" value="today" />
                <SubmitButton variant="default" className="w-full justify-start">
                  <FileText className="size-4" />
                  生成今日沟通单
                </SubmitButton>
              </form>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {currentMeetingBrief ? (
                <Link className={buttonVariants({ variant: "outline" })} href={`/notes?note=${currentMeetingBrief.id}`}>
                  <FileText className="size-4" />
                  周报草稿
                </Link>
              ) : (
                <form action={createMeetingBriefNote}>
                  <input type="hidden" name="scope" value="week" />
                  <SubmitButton variant="outline" className="w-full justify-start bg-white/74">
                    <FileText className="size-4" />
                    生成周报
                  </SubmitButton>
                </form>
              )}
              <form action={createMeetingFeedbackNote}>
                <input type="hidden" name="scope" value="week" />
                <SubmitButton variant="outline" className="w-full justify-start bg-white/74">
                  <ClipboardList className="size-4" />
                  回填反馈
                </SubmitButton>
              </form>
            </div>
          </div>

          <p className="mt-3 rounded-xl border border-white/68 bg-white/52 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {currentTodayMeetingBrief
              ? `今日沟通单已生成，更新 ${formatDateTime(currentTodayMeetingBrief.updatedAt)}。`
              : currentMeetingBrief
                ? `已有 ${periodLabel} 周报草稿，更新 ${formatDateTime(currentMeetingBrief.updatedAt)}。`
                : "还没有草稿时，先生成今日沟通单，比从空白文档开始更快。"}
          </p>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2 lg:grid-cols-4">
            <AdvisorPrepTile index="01" title="一句话进展" detail="本周做了什么，先压成一句能讲的话。" done={score >= 1} />
            <AdvisorPrepTile index="02" title="关键证据" detail="有图表、指标、复现或实验观察再展开。" done={score >= 2} />
            <AdvisorPrepTile index="03" title="下周动作" detail="只讲 1-3 个可验收下一步。" done={score >= 3} />
            <AdvisorPrepTile index="04" title="导师判断" detail="把需要拍板的问题提前列出来。" done={score >= 4} />
          </div>

          <div className="grid gap-3 xl:grid-cols-[1fr_16rem]">
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold hero-title">可直接汇报的线索</p>
                <span className="rounded-full border border-white/72 bg-white/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {items.length ? `${items.length} 条` : "暂无"}
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {items.length ? (
                  items.map((item) => <AdvisorPackRow key={item.id} item={item} />)
                ) : (
                  <div className="rounded-xl border border-dashed border-[#cfe0df] bg-white/54 p-3 text-sm text-muted-foreground">
                    暂时没有可自动整理的线索。先记录一个任务、实验、结果或组会提醒。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-sm font-semibold hero-title">会前要问清楚</p>
              <div className="mt-3 grid gap-2">
                {questions.map((question, index) => (
                  <div key={question} className="rounded-xl border border-white/72 bg-white/64 px-3 py-2">
                    <p className="font-mono text-[11px] font-semibold text-primary">Q{index + 1}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{question}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/notes?folder=组会"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                看组会笔记
                <FileText className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AdvisorQuestionQueue({ questions }: { questions: AdvisorQuestionItem[] }) {
  const primary = questions[0];

  return (
    <section className="advisor-question-queue overflow-hidden rounded-3xl border border-border/60 p-4 shadow-[0_18px_42px_rgba(27,42,56,0.048)]">
      <div className="grid gap-4 xl:grid-cols-[0.32fr_0.68fr]">
        <div className="advisor-question-lead rounded-2xl border border-white/70 p-4">
          <span className="research-eyebrow">
            <MessageSquareText className="size-3.5" />
            导师问题队列
          </span>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight hero-title">
            会前别只堆材料，先把要问的问题压到 3 个以内。
          </h2>
          <p className="mt-3 text-sm leading-6 hero-copy">
            任务、实验、结果、文献和事务里最耗时间的是不确定点。这里把它们收成问题队列，
            见导师时先问判断题，再展开证据。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">候选问题</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{questions.length}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">最优先</p>
              <p className="mt-1 line-clamp-1 text-sm font-semibold hero-title">
                {primary?.source ?? "暂无"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-3">
            <AdvisorQuestionStep index="01" title="先问判断" detail="需要导师拍板的方向、优先级或是否继续做。" />
            <AdvisorQuestionStep index="02" title="再给证据" detail="只带能支撑判断的图表、观察或文献线索。" />
            <AdvisorQuestionStep index="03" title="落成动作" detail="沟通后把结论拆回任务、实验或结果证据。" />
          </div>

          <div className="grid gap-2">
            {questions.length ? (
              questions.map((question) => (
                <AdvisorQuestionRow key={question.id} item={question} />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[#cfe0df] bg-white/58 p-4 text-sm leading-6 text-muted-foreground">
                暂时没有可自动推导的问题。先记录一个高优先级任务、失败实验、可讲结果或组会提醒。
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AdvisorQuestionStep({
  detail,
  index,
  title,
}: {
  detail: string;
  index: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">{index}</span>
        <MessageSquareText className="size-3.5 text-primary" />
      </div>
      <p className="mt-3 text-sm font-semibold hero-title">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function AdvisorQuestionRow({ item }: { item: AdvisorQuestionItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group grid gap-3 rounded-2xl border border-white/72 bg-white/64 p-3 transition hover:border-primary/25 hover:bg-white sm:grid-cols-[auto_1fr_auto] sm:items-center"
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${advisorPackToneClass(item.tone)}`}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-[#d8e5ee] bg-[#eef4fb] px-1.5 py-0.5 text-[11px] font-medium text-[#365a7d]">
            {item.source}
          </span>
          <span className="line-clamp-1 text-sm font-semibold hero-title">{item.title}</span>
        </span>
        <span className="mt-1 block text-sm leading-5 text-[var(--workspace-title)]">
          {item.question}
        </span>
        <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">{item.context}</span>
      </span>
      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-white/80 bg-white/72 px-2.5 py-1 text-xs font-semibold text-primary transition group-hover:border-primary/20 group-hover:bg-white">
        {item.action}
      </span>
    </Link>
  );
}

function AdvisorFeedbackLoop({
  feedbackOpenChecklistCount,
  feedbackTaskSource,
  latestFeedbackNote,
  notes,
}: {
  feedbackOpenChecklistCount: number;
  feedbackTaskSource: FeedbackLoopNote | null;
  latestFeedbackNote: FeedbackLoopNote | null;
  notes: FeedbackLoopNote[];
}) {
  const latestHref = latestFeedbackNote ? `/notes?note=${latestFeedbackNote.id}` : "/notes?source=meeting";
  const feedbackWithAction = notes.filter((note) => note.openChecklistCount > 0);

  return (
    <section className="feedback-loop overflow-hidden rounded-3xl border border-border/60 p-4 shadow-[0_18px_42px_rgba(27,42,56,0.045)]">
      <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
        <div className="feedback-loop-lead rounded-2xl border border-white/70 p-4">
          <span className="research-eyebrow">
            <FileCheck2 className="size-3.5" />
            会后反馈闭环
          </span>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight hero-title">
            导师说完之后，5 分钟内把反馈变成下一步。
          </h2>
          <p className="mt-3 text-sm leading-6 hero-copy">
            不再新建一套会议系统。反馈先进入组会笔记，再把未拆清单同步到课题任务，
            同时提醒哪些要回填到实验、成果和文献。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">反馈笔记</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{notes.length}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">待拆动作</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">
                {feedbackOpenChecklistCount}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <form action={createMeetingFeedbackNote}>
              <input type="hidden" name="scope" value="week" />
              <SubmitButton className="w-full justify-start">
                <ClipboardList className="size-4" />
                新建反馈回填
              </SubmitButton>
            </form>
            <Link className={buttonVariants({ variant: "outline" })} href={latestHref}>
              <FileText className="size-4" />
              {latestFeedbackNote ? "打开最近反馈" : "查看组会笔记"}
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-4">
            <FeedbackLoopTile
              done={Boolean(latestFeedbackNote)}
              index="01"
              title="先写原话"
              detail="导师认可、担心和临时判断先完整收住。"
            />
            <FeedbackLoopTile
              done={feedbackOpenChecklistCount > 0}
              index="02"
              title="再拆动作"
              detail="把 checklist 变成项目页能推进的待办。"
            />
            <FeedbackLoopTile
              done={notes.some((note) => /实验|对照|复现|观察/.test(note.content))}
              index="03"
              title="回填实验"
              detail="补观察、失败原因或下一组对照。"
            />
            <FeedbackLoopTile
              done={notes.some((note) => /结果|证据|图表|文献|Zotero/i.test(note.content))}
              index="04"
              title="补证据/文献"
              detail="把图表路径、复现状态或待读文献补齐。"
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-[1fr_17rem]">
            <div className="rounded-2xl border border-white/70 bg-white/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold hero-title">最近反馈记录</p>
                <span className="rounded-full border border-white/72 bg-white/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {feedbackWithAction.length ? `${feedbackWithAction.length} 篇有待办` : "无待拆清单"}
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {notes.length ? (
                  notes.slice(0, 3).map((note) => (
                    <FeedbackLoopRow key={note.id} note={note} />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[#cfe0df] bg-white/54 p-3 text-sm text-muted-foreground">
                    还没有导师反馈记录。会后点“新建反馈回填”，先把原话和下一步收住。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/60 p-3">
              <p className="text-sm font-semibold hero-title">一键回到课题</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                有待办清单时，直接拆成项目页任务；没有清单时先打开最近反馈补几条。
              </p>
              <div className="mt-3 grid gap-2">
                {feedbackTaskSource ? (
                  <form action={createTasksFromNoteChecklist}>
                    <input type="hidden" name="id" value={feedbackTaskSource.id} />
                    <SubmitButton className="w-full justify-start">
                      <ListActionIcon />
                      拆成任务
                    </SubmitButton>
                  </form>
                ) : (
                  <Link className={buttonVariants({ variant: "outline" })} href={latestHref}>
                    <PenActionIcon />
                    先补反馈清单
                  </Link>
                )}
                <Link className={buttonVariants({ variant: "outline" })} href="/projects?status=todo">
                  <ClipboardList className="size-4" />
                  查看待办
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeedbackLoopTile({
  detail,
  done,
  index,
  title,
}: {
  detail: string;
  done: boolean;
  index: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">{index}</span>
        <span
          className={
            done
              ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
              : "rounded-full border border-[#ead8ac] bg-[#fff8e8] px-2 py-0.5 text-[11px] font-medium text-[#7a5a2f]"
          }
        >
          {done ? "已覆盖" : "待补"}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold hero-title">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function FeedbackLoopRow({ note }: { note: FeedbackLoopNote }) {
  return (
    <Link
      href={`/notes?note=${note.id}`}
      className="group grid gap-3 rounded-xl border border-white/72 bg-white/66 p-3 transition hover:border-primary/25 hover:bg-white sm:grid-cols-[auto_1fr_auto] sm:items-center"
    >
      <span className="flex size-9 items-center justify-center rounded-xl border border-[#d5e4e8] bg-[#eef6f7] text-primary">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="line-clamp-1 text-sm font-semibold hero-title">{note.title}</span>
        <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">
          更新 {formatDateTime(note.updatedAt)}
        </span>
      </span>
      <span className="rounded-full border border-white/80 bg-white/78 px-2.5 py-1 text-xs font-medium text-primary">
        {note.openChecklistCount ? `${note.openChecklistCount} 个动作` : "已收口"}
      </span>
    </Link>
  );
}

function ListActionIcon() {
  return <ClipboardList className="size-4" />;
}

function PenActionIcon() {
  return <FileText className="size-4" />;
}

function AdvisorPrepTile({
  detail,
  done,
  index,
  title,
}: {
  detail: string;
  done: boolean;
  index: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/56 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">{index}</span>
        <span
          className={
            done
              ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
              : "rounded-full border border-[#ead8ac] bg-[#fff8e8] px-2 py-0.5 text-[11px] font-medium text-[#7a5a2f]"
          }
        >
          {done ? "有材料" : "待补"}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold hero-title">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function AdvisorPackRow({ item }: { item: AdvisorPackItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group grid gap-3 rounded-xl border border-white/72 bg-white/64 p-3 transition hover:border-primary/25 hover:bg-white sm:grid-cols-[auto_1fr_auto] sm:items-center"
    >
      <span className={`flex size-9 items-center justify-center rounded-xl border ${advisorPackToneClass(item.tone)}`}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-[#d8e5ee] bg-[#eef4fb] px-1.5 py-0.5 text-[11px] font-medium text-[#365a7d]">
            {item.label}
          </span>
          <span className="line-clamp-1 text-sm font-semibold hero-title">{item.title}</span>
        </span>
        <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">{item.detail}</span>
      </span>
      <span className="text-xs font-semibold text-primary">{item.action}</span>
    </Link>
  );
}

function advisorPackToneClass(tone: AdvisorPackItem["tone"]) {
  const classes = {
    admin: "border-[#ead8ac] bg-[#fff8e8] text-[#7a5a2f]",
    experiment: "border-[#cfe0df] bg-[#eef7f3] text-[#2f6655]",
    paper: "border-[#d8e5ee] bg-[#eef3fb] text-[#365a7d]",
    result: "border-[#eadfbf] bg-[#f7f1df] text-[#7a5a2f]",
    task: "border-[#d5e4e8] bg-[#eef6f7] text-primary",
  };

  return classes[tone];
}

function AdminReliefCard({ item, index }: { item: AdminItem; index: number }) {
  const typeMeta = itemTypes.find((type) => type.value === item.type);
  const Icon = typeMeta?.icon ?? ClipboardList;

  return (
    <Card className="workbench-card border-[#d7e3e8]/90 bg-white/84">
      <CardContent className="grid h-full gap-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#d5e4e8] bg-[#eef6f4] font-mono text-xs font-semibold text-[#315266]">
            0{index}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-[#d5e4e8] bg-white/78 px-2.5 py-1 text-xs text-muted-foreground">
            <Icon className="size-3.5" />
            {typeMeta?.label ?? "事务"}
          </span>
        </div>

        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-5">{item.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{dueText(item.dueDate)}</p>
        </div>

        <div className="rounded-xl border border-[#d5e4e8] bg-[#f5fafb] p-3">
          <p className="text-sm font-medium text-[var(--workspace-title)]">
            {adminActionLabel(item)}
          </p>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
            {adminActionReason(item)}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border/65 pt-3">
          <form action={setAdminStatus} className="flex gap-2">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="status" value={item.status === "todo" ? "doing" : "done"} />
            <Button type="submit" variant="outline" size="sm">
              {item.status === "todo" ? "开始处理" : "标记完成"}
            </Button>
          </form>
          <CreateDialog title="编辑事务" label="编辑" icon={Edit3} wide>
            <AdminItemForm action={updateAdminItem} item={item} />
          </CreateDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminTimelineCard({ item }: { item: AdminItem }) {
  const typeMeta = itemTypes.find((type) => type.value === item.type);
  const Icon = typeMeta?.icon ?? ClipboardList;

  return (
    <Card className="workbench-card overflow-hidden">
      <CardContent className="grid gap-3 py-4">
        <div className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-start">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#d7e7ea] bg-[#eef7f7] text-primary">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={item.type} />
              <StatusBadge value={item.status} />
              <span className="rounded-md border border-[#d8e5ee] bg-[#eef4fb] px-1.5 py-0.5 text-[11px] text-[#365a7d]">
                {adminActionLabel(item)}
              </span>
              <span className="rounded-md border bg-white/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {dueText(item.dueDate)}
              </span>
            </div>
            <h2 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">
              {item.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              更新 {formatDateTime(item.updatedAt)}
            </p>
          </div>
          <form action={setAdminStatus} className="flex gap-2">
            <input type="hidden" name="id" value={item.id} />
            <select
              name="status"
              defaultValue={item.status}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="todo">待办</option>
              <option value="doing">进行中</option>
              <option value="done">完成</option>
            </select>
            <Button type="submit" variant="outline" size="sm">
              更新
            </Button>
          </form>
        </div>

        {item.location ? (
          <p className="flex items-center gap-2 soft-tile rounded-xl p-3 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" />
            {item.location}
          </p>
        ) : null}

        {item.notes ? (
          <p className="text-sm leading-6 text-muted-foreground">{item.notes}</p>
        ) : null}

        <div className="rounded-xl border border-[#d5e4e8] bg-[#f5fafb] p-3">
          <p className="flex items-center gap-2 text-xs font-medium text-[#315266]">
            <Sparkles className="size-3.5" />
            行动理由
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{adminActionReason(item)}</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/65 pt-3 md:flex-row md:items-center md:justify-between">
          <TagList value={item.tags} />
          <div className="flex flex-wrap items-center gap-2">
            <CreateDialog title="编辑事务" label="编辑" icon={Edit3} wide>
              <AdminItemForm action={updateAdminItem} item={item} />
            </CreateDialog>
            <form action={deleteAdminItem}>
              <input type="hidden" name="id" value={item.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="size-3.5" />
                删除
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminItemForm({
  action,
  item,
}: {
  action: (formData: FormData) => Promise<void>;
  item?: AdminItem;
}) {
  return (
    <form action={action} className="grid gap-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      <div className="rounded-2xl border border-[#d5e4e8] bg-[#f8fbf8]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#cfe0e4] bg-white text-primary">
            <Inbox className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--workspace-title)]">
              {item ? "调整事务减负卡" : "把小事从脑子里移走"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              只记录会影响科研节奏的组会、材料、报销和硬截止，处理完就回到研究主线。
            </p>
          </div>
        </div>
        <Input
          name="title"
          required
          placeholder="例如：周五组会准备两页结果图 / 报销单补导师签字"
          defaultValue={item?.title ?? ""}
          className="mt-3 h-11 border-[#cadbe1] bg-white/92 text-base font-medium"
        />
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-white/72 p-3 md:grid-cols-3">
        <Field label="类型">
          <select
            name="type"
            defaultValue={item?.type ?? "meeting"}
            className="h-9 rounded-lg border border-[#d4e0e5] bg-white/90 px-2 text-sm outline-none transition focus:border-primary/40 focus:ring-3 focus:ring-ring/18"
          >
            {itemTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="状态">
          <select
            name="status"
            defaultValue={item?.status ?? "todo"}
            className="h-9 rounded-lg border border-[#d4e0e5] bg-white/90 px-2 text-sm outline-none transition focus:border-primary/40 focus:ring-3 focus:ring-ring/18"
          >
            <option value="todo">待处理</option>
            <option value="doing">处理中</option>
            <option value="done">已收口</option>
          </select>
        </Field>
        <Field label="截止">
          <Input
            name="dueDate"
            type="date"
            defaultValue={item?.dueDate ? item.dueDate.toISOString().slice(0, 10) : ""}
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_0.78fr]">
        <Field label="地点 / 渠道" hint="会议室、微信群、学院系统、报销平台等。">
          <Input
            name="location"
            defaultValue={item?.location ?? ""}
            placeholder="例如：腾讯会议 / 学院系统 / 财务处"
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
        <Field label="标签">
          <Input
            name="tags"
            defaultValue={parseTags(item?.tags).join(", ")}
            placeholder="组会, 学院, 报销"
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
      </div>

      <Field
        label="处理所需上下文"
        hint="把入口、单号、需要谁确认、缺什么材料写清楚；不要写成完整流程文档。"
      >
        <Textarea
          name="notes"
          rows={5}
          defaultValue={item?.notes ?? ""}
          placeholder={"入口/地点：\n需要确认：\n缺项："}
          className="min-h-36 border-[#d4e0e5] bg-[#fffef9]/96 leading-6"
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d5e4e8] bg-[#eef6f4] px-3 py-2">
        <p className="flex min-w-0 items-center gap-2 text-xs leading-5 text-[#315266]">
          <FileCheck2 className="size-3.5 shrink-0" />
          保存后会进入减负栈，周报草稿也能自动带上相关提醒。
        </p>
        <SubmitButton>{item ? "保存事务" : "加入减负栈"}</SubmitButton>
      </div>
    </form>
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

  return `${distance} 天后 · ${formatDate(value)}`;
}

function adminActionLabel(item: AdminItem) {
  if (item.status === "done") {
    return "已收口";
  }

  const distance = daysUntil(item.dueDate);

  if (distance !== null && distance < 0) {
    return "先补逾期";
  }

  if (distance === 0) {
    return "今天处理";
  }

  if (item.status === "doing") {
    return "继续推进";
  }

  if (item.type === "meeting") {
    return "准备组会";
  }

  if (item.type === "reimbursement") {
    return "补报销材料";
  }

  if (item.type === "material") {
    return "整理材料";
  }

  return "安排处理";
}

function adminActionReason(item: AdminItem) {
  if (item.status === "done") {
    return "这件事已经收口，可以暂时从注意力里移开。";
  }

  const distance = daysUntil(item.dueDate);

  if (distance !== null && distance < 0) {
    return "已经逾期，先补状态或改期，避免继续占用脑内缓存。";
  }

  if (distance === 0) {
    return "今天到期，先处理或明确下一步，避免打断后面的科研时间。";
  }

  if (item.status === "doing") {
    return "已经开始推进，优先补齐材料、地点或下一步，别让它悬空。";
  }

  if (item.type === "meeting") {
    return "组会会牵动任务、实验和结果，先准备可汇报材料。";
  }

  if (item.type === "reimbursement") {
    return "报销最容易丢票据和流程，先把材料入口、单号或缺项写清楚。";
  }

  if (item.type === "material") {
    return "材料类事项通常有隐性截止，先确认入口、格式和提交对象。";
  }

  return "先登记最小下一步，处理完就回到文献、实验和结果。";
}

function prioritizeAdminRelief(items: AdminItem[]) {
  return items
    .filter((item) => item.status !== "done")
    .sort((left, right) => {
      const rank = adminItemRank(left) - adminItemRank(right);
      if (rank !== 0) return rank;

      return right.updatedAt.getTime() - left.updatedAt.getTime();
    });
}

function adminItemRank(item: AdminItem) {
  if (item.status === "done") {
    return 1000;
  }

  const distance = daysUntil(item.dueDate);
  const dueRank = distance === null ? 20 : Math.min(distance, 20);
  const statusRank = item.status === "doing" ? -2 : 0;
  const meetingRank = item.type === "meeting" ? -0.5 : 0;

  return dueRank + statusRank + meetingRank;
}

function prioritizeAdvisorQuestions(items: AdvisorQuestionItem[]) {
  const seen = new Set<string>();

  return [...items]
    .sort((left, right) => {
      const rank = left.rank - right.rank;
      if (rank !== 0) return rank;

      return left.title.localeCompare(right.title, "zh-CN");
    })
    .filter((item) => {
      const key = `${item.source}:${item.title}:${item.question}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
