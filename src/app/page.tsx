import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  FlaskConical,
  NotebookPen,
  ScrollText,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TagList } from "@/components/shared/tag-list";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { daysUntil, formatDate, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [taskCounts, upcomingTasks, recentExperiments, recentPapers, adminItems] =
    await Promise.all([
      prisma.task.groupBy({ by: ["status"], _count: true }),
      prisma.task.findMany({
        where: { status: { not: "done" } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 5,
        include: { milestone: { include: { project: true } } },
      }),
      prisma.experiment.findMany({
        orderBy: { updatedAt: "desc" },
        take: 3,
        include: { project: true },
      }),
      prisma.paper.findMany({
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      prisma.adminItem.findMany({
        where: { status: { not: "done" } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 3,
      }),
    ]);

  const todo = taskCounts.find((item) => item.status === "todo")?._count ?? 0;
  const doing = taskCounts.find((item) => item.status === "doing")?._count ?? 0;
  const done = taskCounts.find((item) => item.status === "done")?._count ?? 0;
  const totalTasks = todo + doing + done;
  const openTasks = todo + doing;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="首页"
        title="今天只看最要紧的事"
        description="任务、实验、文献和组会材料收在一屏里，先处理临近事项，再补记录。"
        actions={
          <>
            <Link className={buttonVariants({ variant: "default" })} href="/projects">
              <ClipboardList className="size-4" />
              看任务
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/experiments">
              <NotebookPen className="size-4" />
              记实验
            </Link>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <TodayCard
          label="待处理"
          value={`${openTasks} 个`}
          detail={totalTasks ? `已完成 ${done} / ${totalTasks}` : "还没有任务"}
        />
        <TodayCard
          label="下一件事"
          value={upcomingTasks[0]?.title ?? "暂无"}
          detail={upcomingTasks[0] ? dueText(upcomingTasks[0].dueDate) : "可以先去项目页建任务"}
        />
        <TodayCard
          label="最近实验"
          value={recentExperiments[0]?.title ?? "暂无"}
          detail={recentExperiments[0]?.project?.title ?? "保持记录节奏"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" />
              近期任务
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length ? (
              <div className="grid gap-2">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border bg-[#fffdf7] p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{task.title}</p>
                          <StatusBadge value={task.priority} kind="priority" />
                          <StatusBadge value={task.status} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.milestone?.project.title ?? "独立任务"} /{" "}
                          {task.milestone?.title ?? "未挂载里程碑"}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{dueText(task.dueDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="暂无待办任务"
                description="去项目页添加第一批任务后，这里会自动排序。"
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <MiniListCard
            title="最近实验"
            icon={FlaskConical}
            items={recentExperiments.map((experiment) => ({
              id: experiment.id,
              title: experiment.title,
              meta: experiment.project?.title ?? statusLabel(experiment.status),
            }))}
            empty="还没有实验记录"
          />
          <MiniListCard
            title="轻行政"
            icon={ClipboardList}
            items={adminItems.map((item) => ({
              id: item.id,
              title: item.title,
              meta: `${formatDate(item.dueDate)} ${item.location ? `/ ${item.location}` : ""}`,
            }))}
            empty="暂无组会或材料待办"
          />
        </div>
      </section>

      <Card className="rounded-lg bg-white/95">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="size-4" />
            最近文献
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {recentPapers.length ? (
            recentPapers.map((paper) => (
              <div key={paper.id} className="rounded-lg border p-3">
                <p className="line-clamp-2 font-medium">{paper.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {paper.year ?? "年份未知"} / {statusLabel(paper.readStatus)}
                </p>
                <div className="mt-2">
                  <TagList value={paper.tags} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">同步 Zotero 后，这里会显示最近文献。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TodayCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-lg bg-white/95">
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 line-clamp-1 text-lg font-semibold">{value}</p>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function MiniListCard({
  title,
  icon: Icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{ id: string; title: string; meta: string }>;
  empty: string;
}) {
  return (
    <Card className="rounded-lg bg-white/95">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <p className="line-clamp-1 font-medium">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
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

  return `${distance} 天后`;
}
