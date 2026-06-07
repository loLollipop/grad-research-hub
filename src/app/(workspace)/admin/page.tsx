import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Edit3,
  FileText,
  MapPin,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
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
import { CreateDialog } from "@/components/shared/create-dialog";
import { Field } from "@/components/shared/field";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; type?: string; status?: string }>;
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

export default async function AdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q)?.trim();
  const type = first(params.type);
  const status = first(params.status);

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

  const [items, typeCounts, statusCounts] = await Promise.all([
    prisma.adminItem.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.adminItem.groupBy({ by: ["type"], _count: true }),
    prisma.adminItem.groupBy({ by: ["status"], _count: true }),
  ]);

  const openItems = items.filter((item) => item.status !== "done");
  const doneCount = statusCounts.find((item) => item.status === "done")?._count ?? 0;
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

  return (
    <div className="grid gap-5">
      <section className="dashboard-hero overflow-hidden rounded-2xl border border-border/70 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.08)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_0.86fr] xl:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/65 bg-white/72 px-2.5 py-1 text-xs font-medium text-[#315266]">
                <ClipboardList className="size-3.5" />
                轻事务时间线
              </span>
              <span className="rounded-full border border-white/55 bg-white/54 px-2.5 py-1 text-xs text-muted-foreground">
                组会 · 材料 · 报销 · 截止
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-[2rem] font-semibold leading-tight tracking-tight text-[#173042] md:text-[2.5rem]">
              把烦人的小事收起来，不让它们偷走科研注意力。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#557083]">
              事务页只登记真正会打断你的事：组会地点、材料截止、报销进度和学院通知。
              首页会汇总近期事项，这里负责快速筛选和收口。
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
              <form action={createMeetingBriefNote}>
                <input type="hidden" name="scope" value="week" />
                <SubmitButton variant="outline">
                  <FileText className="size-4" />
                  生成组会草稿
                </SubmitButton>
              </form>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SignalCard icon={Clock3} label="待处理" value={`${openItems.length} 件`} detail={`${doneCount} 件已完成`} />
            <SignalCard icon={CalendarClock} label="今天截止" value={`${dueToday.length} 件`} detail={`${overdue.length} 件逾期`} />
            <SignalCard icon={CheckCircle2} label="7 天内" value={`${upcoming.length} 件`} detail="近期优先看" />
            <SignalCard icon={ClipboardList} label="当前筛选" value={`${items.length} 件`} detail={q || type || status ? "已应用筛选" : "全部事务"} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
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
                <div className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3">
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
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂时没有待处理事务。</p>
              )}
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle>事务分布</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {itemTypes.map(({ value, label, icon: Icon }) => (
                <a
                  key={value}
                  href={`/admin?type=${value}`}
                  className="flex items-center justify-between rounded-xl border border-border/72 bg-[#fbfcfd]/88 px-3 py-2 transition hover:border-primary/25 hover:bg-white"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    {label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {typeCounts.find((item) => item.type === value)?._count ?? 0}
                  </span>
                </a>
              ))}
            </CardContent>
          </Card>
        </aside>

        <div className="grid gap-3">
          <div className="grid gap-3 rounded-2xl border border-[#d8e3e7] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(239,245,249,0.82))] p-3 shadow-[0_12px_28px_rgba(27,42,56,0.045)] lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#173042]">组会前快速整理</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                自动把近期任务、事务、实验、结果和待读文献汇成一篇组会笔记，生成后直接编辑。
              </p>
            </div>
            <form action={createMeetingBriefNote}>
              <input type="hidden" name="scope" value="week" />
              <SubmitButton variant="default" className="w-fit">
                <FileText className="size-4" />
                生成准备笔记
              </SubmitButton>
            </form>
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
            <div className="grid gap-3">
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

function SignalCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-white/72 bg-white/76 shadow-[0_12px_28px_rgba(27,42,56,0.06)] backdrop-blur">
      <CardContent className="flex items-start gap-3 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d7e7ea] bg-[#eef7f7] text-[#315266]">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-[#173042]">{value}</p>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{detail}</p>
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
          <p className="flex items-center gap-2 rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" />
            {item.location}
          </p>
        ) : null}

        {item.notes ? (
          <p className="text-sm leading-6 text-muted-foreground">{item.notes}</p>
        ) : null}

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
