import {
  AlertCircle,
  CalendarClock,
  ClipboardList,
  Clock3,
  Edit3,
  FileCheck2,
  FileText,
  MapPin,
  Plus,
  ReceiptText,
  Search,
  Sparkles,
  Trash2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { AdminItem, Prisma } from "@prisma/client";

import {
  createMeetingBriefNote,
  createAdminItem,
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
  const meetingBriefPeriod = getMeetingBriefPeriod();
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
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    where.dueDate = { lt: tomorrow };
    if (!status) {
      where.status = { not: "done" };
    }
  }

  const [items, allAdminItems, typeCounts, statusCounts, currentMeetingBrief] = await Promise.all([
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
  ]);

  const openItems = items.filter((item) => item.status !== "done");
  const dueToday = openItems.filter((item) => daysUntil(item.dueDate) === 0);
  const overdue = openItems.filter((item) => {
    const distance = daysUntil(item.dueDate);
    return distance !== null && distance < 0;
  });
  const upcoming = openItems.filter((item) => {
    const distance = daysUntil(item.dueDate);
    return distance !== null && distance >= 0 && distance <= 7;
  });
  const focusItem = overdue[0] ?? dueToday[0] ?? upcoming[0] ?? openItems[0];
  const adminStack = [...items]
    .sort((left, right) => adminItemRank(left) - adminItemRank(right))
    .slice(0, 3);
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
              把组会、周报、材料截止和报销进度收在一起。这里优先告诉你今天要收口什么，
              周报草稿会自动带上任务、实验、结果和待读文献。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <CreateDialog
                title="新增事务"
                description="适合记录组会安排、学院材料、报销进度和硬截止。"
                label="新增事务"
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
                <p className="text-lg font-semibold tracking-tight">{openItems.length}</p>
                <p className="mt-0.5 text-[11px] text-white/54">待处理</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{dueToday.length + overdue.length}</p>
                <p className="mt-0.5 text-[11px] text-white/54">今天/逾期</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{upcoming.length}</p>
                <p className="mt-0.5 text-[11px] text-white/54">7 天内</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="workbench-dual-grid grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
        <aside className="grid content-start gap-4">
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

          <div className="grid gap-3 rounded-2xl border border-[#d8e3e7] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(239,245,249,0.82))] p-3 shadow-[0_12px_28px_rgba(27,42,56,0.045)] lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#173042]">
                {currentMeetingBrief ? "本周组会/周报草稿已经准备好" : "组会/导师周报准备"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {currentMeetingBrief
                  ? `覆盖 ${meetingBriefPeriod.shortLabel}，最近更新 ${formatDateTime(currentMeetingBrief.updatedAt)}。`
                  : "自动把近期任务、事务、实验、结果和待读文献汇成一篇可编辑草稿，先写结论，再删减细节。"}
              </p>
            </div>
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
                  生成周报笔记
                </SubmitButton>
              </form>
            )}
          </div>

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
              title="暂无行政事务"
              description="把组会、材料和报销先登记起来，首页会自动汇总近期事项。"
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
    <form action={action} className="grid gap-3">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <Field label="事务标题">
        <Input name="title" required defaultValue={item?.title ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="类型">
          <select
            name="type"
            defaultValue={item?.type ?? "meeting"}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
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
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="todo">待办</option>
            <option value="doing">进行中</option>
            <option value="done">完成</option>
          </select>
        </Field>
        <Field label="截止">
          <Input
            name="dueDate"
            type="date"
            defaultValue={item?.dueDate ? item.dueDate.toISOString().slice(0, 10) : ""}
          />
        </Field>
      </div>
      <Field label="地点 / 渠道">
        <Input name="location" defaultValue={item?.location ?? ""} />
      </Field>
      <Field label="标签">
        <Input name="tags" defaultValue={parseTags(item?.tags).join(", ")} />
      </Field>
      <Field label="备注">
        <Textarea
          name="notes"
          rows={4}
          defaultValue={item?.notes ?? ""}
          placeholder="只写关键上下文，例如会议地点、材料入口、报销单号。"
        />
      </Field>
      <SubmitButton>{item ? "保存事务" : "创建事务"}</SubmitButton>
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
