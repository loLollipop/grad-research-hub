import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  FlaskConical,
  NotebookTabs,
  ScrollText,
} from "lucide-react";

import { TaskStatusChart } from "@/components/charts/task-status-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TagList } from "@/components/shared/tag-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { prisma } from "@/lib/db";
import { daysUntil, formatDate, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    taskCounts,
    papersCount,
    experimentsCount,
    notesCount,
    upcomingTasks,
    recentExperiments,
    recentPapers,
    adminItems,
  ] = await Promise.all([
    prisma.task.groupBy({ by: ["status"], _count: true }),
    prisma.paper.count(),
    prisma.experiment.count(),
    prisma.note.count(),
    prisma.task.findMany({
      where: { status: { not: "done" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: { milestone: { include: { project: true } } },
    }),
    prisma.experiment.findMany({
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: { project: true },
    }),
    prisma.paper.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.adminItem.findMany({
      where: { status: { not: "done" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 4,
    }),
  ]);

  const todo = taskCounts.find((item) => item.status === "todo")?._count ?? 0;
  const doing = taskCounts.find((item) => item.status === "doing")?._count ?? 0;
  const done = taskCounts.find((item) => item.status === "done")?._count ?? 0;
  const totalTasks = todo + doing + done;
  const doneRate = totalTasks ? Math.round((done / totalTasks) * 100) : 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="首页"
        title="今天先把散落的事情收拢"
        description="首页汇总项目任务、文献阅读、实验记录和轻行政事务，让每一天都有清晰入口。"
      />

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "未完成任务", value: todo + doing, icon: ClipboardList },
          { label: "文献条目", value: papersCount, icon: ScrollText },
          { label: "实验记录", value: experimentsCount, icon: FlaskConical },
          { label: "知识笔记", value: notesCount, icon: NotebookTabs },
        ].map((item) => (
          <Card key={item.label} className="rounded-lg bg-white/90">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{item.value}</p>
              </div>
              <item.icon className="size-5 text-[#1f3d33]" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" />
              近期任务
            </CardTitle>
            <CardDescription>按截止日期排序，优先处理临近事项。</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length ? (
              <div className="grid gap-2">
                {upcomingTasks.map((task) => {
                  const distance = daysUntil(task.dueDate);
                  return (
                    <div
                      key={task.id}
                      className="grid gap-2 rounded-lg border bg-[#fffdf7] p-3 md:grid-cols-[1fr_auto]"
                    >
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
                      <div className="text-right text-sm">
                        <p>{formatDate(task.dueDate)}</p>
                        <p className="text-xs text-muted-foreground">
                          {distance === null
                            ? "无截止"
                            : distance < 0
                              ? `逾期 ${Math.abs(distance)} 天`
                              : distance === 0
                                ? "今天截止"
                                : `${distance} 天后`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={ClipboardList}
                title="暂无待办任务"
                description="去项目页添加里程碑和任务后，这里会自动汇总。"
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4" />
              任务完成度
            </CardTitle>
            <CardDescription>当前任务池的状态分布。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <TaskStatusChart
              data={[
                { name: "待办", value: todo },
                { name: "进行", value: doing },
                { name: "完成", value: done },
              ]}
            />
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>完成比例</span>
                <span>{doneRate}%</span>
              </div>
              <Progress value={doneRate} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>最近实验</CardTitle>
            <CardDescription>持续记录比一次性补日志更可靠。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {recentExperiments.map((experiment) => (
              <div key={experiment.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{experiment.title}</p>
                  <StatusBadge value={experiment.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {experiment.project?.title ?? "未关联项目"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>最近文献</CardTitle>
            <CardDescription>阅读状态和标签会进入全局搜索。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {recentPapers.map((paper) => (
              <div key={paper.id} className="rounded-lg border p-3">
                <p className="line-clamp-2 font-medium">{paper.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {paper.year ?? "年份未知"} / {statusLabel(paper.readStatus)}
                </p>
                <div className="mt-2">
                  <TagList value={paper.tags} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>轻行政</CardTitle>
            <CardDescription>把组会、材料、报销也放进同一张雷达上。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {adminItems.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{item.title}</p>
                  <StatusBadge value={item.type} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(item.dueDate)} {item.location ? `/ ${item.location}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
