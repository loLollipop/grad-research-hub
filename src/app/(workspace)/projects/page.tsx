import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Beaker,
  CheckCircle2,
  Edit3,
  Flag,
  FolderKanban,
  ListChecks,
  ListTodo,
  Plus,
  Route,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Milestone, Prisma, Project, Task } from "@prisma/client";

import {
  attachTaskToMilestone,
  createMilestone,
  createProject,
  createExperimentFromTask,
  createProjectProgressNote,
  createTask,
  deleteMilestone,
  deleteProject,
  deleteTask,
  setTaskStatus,
  updateMilestone,
  updateProject,
  updateTask,
  updateTaskStatuses,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import {
  daysUntil,
  formatDate,
  parseTags,
} from "@/lib/format";
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
  searchParams: Promise<{
    q?: string;
    project?: string;
    status?: string;
    priority?: string;
    scope?: string;
    taskBulk?: string;
    taskBulkCount?: string;
    taskBulkStatus?: string;
    taskSync?: string;
    taskSyncCount?: string;
    taskAttach?: string;
    taskPlan?: string;
  }>;
};

type ProjectFull = Project & {
  milestones: Array<Milestone & { tasks: Task[] }>;
  experiments: { id: string }[];
};

type MilestoneFull = Milestone & {
  project: Project;
  tasks: Task[];
};

type TaskFull = Task & {
  milestone: (Milestone & { project: Project }) | null;
};

const taskColumns = [
  { id: "todo", label: "待办", hint: "还没开始", tone: "bg-[#f5f7fb]" },
  { id: "doing", label: "进行中", hint: "今天推进", tone: "bg-[#eef7f6]" },
  { id: "done", label: "完成", hint: "已收口", tone: "bg-[#f3f6ef]" },
];

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = valueOf(params.q)?.trim();
  const projectId = valueOf(params.project);
  const status = valueOf(params.status);
  const priority = valueOf(params.priority);
  const rawScope = valueOf(params.scope);
  const scope = rawScope && ["today", "week"].includes(rawScope) ? rawScope : undefined;
  const taskBulk = valueOf(params.taskBulk);
  const taskBulkCount = Number(valueOf(params.taskBulkCount) ?? 0);
  const taskBulkStatus = valueOf(params.taskBulkStatus);
  const taskSync = valueOf(params.taskSync);
  const taskSyncCount = Number(valueOf(params.taskSyncCount) ?? 0);
  const taskAttach = valueOf(params.taskAttach);
  const taskPlan = valueOf(params.taskPlan);
  const activeFilterCount = [q, projectId, status, priority, scope].filter(Boolean).length;
  const currentFilters = { q, project: projectId, status, priority, scope };
  const currentQuery = new URLSearchParams();
  if (q) currentQuery.set("q", q);
  if (projectId) currentQuery.set("project", projectId);
  if (status) currentQuery.set("status", status);
  if (priority) currentQuery.set("priority", priority);
  if (scope) currentQuery.set("scope", scope);
  const returnTo = currentQuery.size ? `/projects?${currentQuery.toString()}` : "/projects";
  const todayStart = startOfDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);
  const weekEnd = addDays(todayStart, 8);
  const taskFilters: Prisma.TaskWhereInput[] = [];
  if (q) {
    taskFilters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { tags: { contains: q, mode: "insensitive" } },
        { milestone: { title: { contains: q, mode: "insensitive" } } },
        { milestone: { project: { title: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (projectId) {
    taskFilters.push({ milestone: { projectId } });
  }
  if (status && ["todo", "doing", "done"].includes(status)) {
    taskFilters.push({ status });
  }
  if (priority && ["high", "medium", "low"].includes(priority)) {
    taskFilters.push({ priority });
  }
  if (scope === "today") {
    taskFilters.push({ dueDate: { lt: tomorrowStart } });
  }
  if (scope === "week") {
    taskFilters.push({ dueDate: { lt: weekEnd } });
  }
  if (scope && !status) {
    taskFilters.push({ status: { not: "done" } });
  }
  const taskWhere: Prisma.TaskWhereInput = taskFilters.length ? { AND: taskFilters } : {};

  const [projects, milestones, tasks, allTasks] = await Promise.all([
    prisma.project.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        milestones: {
          include: { tasks: true },
          orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        },
        experiments: { select: { id: true } },
      },
    }),
    prisma.milestone.findMany({
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      include: { project: true, tasks: true },
    }),
    prisma.task.findMany({
      where: taskWhere,
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }, { updatedAt: "desc" }],
      include: { milestone: { include: { project: true } } },
    }),
    prisma.task.findMany({
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }, { updatedAt: "desc" }],
      include: { milestone: { include: { project: true } } },
    }),
  ]);

  const activeProjects = projects.filter((project) => project.status === "active");
  const allOpenTasks = allTasks.filter((task) => task.status !== "done");
  const allDoneTasks = allTasks.filter((task) => task.status === "done");
  const quickBaseTasks = allTasks.filter((task) => taskMatchesProjectBase(task, q, projectId));
  const quickOpenTasks = quickBaseTasks.filter((task) => task.status !== "done");
  const openTasks = tasks.filter((task) => task.status !== "done");
  const nextTasks = [...openTasks]
    .sort((left, right) => taskRank(left) - taskRank(right))
    .slice(0, 6);
  const projectStack = [...quickOpenTasks]
    .sort((left, right) => taskRank(left) - taskRank(right))
    .slice(0, 3);
  const nextMilestones = milestones
    .filter((milestone) => milestone.status !== "completed")
    .slice(0, 5);
  const completion = allTasks.length ? Math.round((allDoneTasks.length / allTasks.length) * 100) : 0;
  const selectedProjectTitle = projects.find((project) => project.id === projectId)?.title;
  const todayOpenTasks = quickOpenTasks.filter((task) => {
    const distance = daysUntil(task.dueDate);
    return distance !== null && distance <= 0;
  });
  const weekOpenTasks = quickOpenTasks.filter((task) => {
    const distance = daysUntil(task.dueDate);
    return distance !== null && distance <= 7;
  });
  const highOpenTasks = quickOpenTasks.filter((task) => task.priority === "high");
  const doingTasks = quickOpenTasks.filter((task) => task.status === "doing");

  return (
    <div className="grid gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="research-eyebrow">
                <Route className="size-3.5" />
                课题路线图
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                阶段 · 里程碑 · 下一步
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              项目页只回答一个问题：下一步推进什么。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              课题可以很复杂，但每天推进不该复杂。这里把项目压成路线图、里程碑和任务队列，
              少填字段，多看状态，让你打开后直接进入行动。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <CreateDialog
                title="新建项目"
                description="只写课题名、当前状态和一句话目标，细节后面再补。"
                label="新建项目"
                icon={Plus}
              >
                <ProjectForm action={createProject} />
              </CreateDialog>
              <CreateDialog
                title="新建里程碑"
                description="把大课题切成可以验收的阶段。"
                label="新建里程碑"
                icon={Flag}
              >
                <MilestoneForm action={createMilestone} projects={projects} />
              </CreateDialog>
              <CreateDialog
                title="新建任务"
                description="只记录下一步动作，不要把任务写成论文摘要。"
                label="新建任务"
                icon={ListTodo}
                wide
              >
                <TaskForm action={createTask} milestones={milestones} />
              </CreateDialog>
              <form action={createProjectProgressNote}>
                <input type="hidden" name="returnTo" value={returnTo} />
                {tasks.slice(0, 12).map((task) => (
                  <input key={task.id} type="hidden" name="ids" value={task.id} />
                ))}
                <SubmitButton variant="outline" disabled={!tasks.length}>
                  <ListChecks className="size-4" />
                  生成推进笔记
                </SubmitButton>
              </form>
            </div>
          </div>

          <div className="flex min-h-64 flex-col justify-between rounded-2xl action-stack p-4 text-white shadow-[0_18px_36px_rgba(22,34,53,0.16)]">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-white/68">
                <FolderKanban className="size-3.5" />
                今日推进栈
              </p>
              <div className="mt-4 grid gap-2.5">
                {projectStack.length ? (
                  projectStack.map((task, index) => (
                    <ProjectStackItem
                      key={task.id}
                      index={`0${index + 1}`}
                      title={task.title}
                      detail={`${task.milestone?.project.title ?? "独立任务"} · ${dueText(task.dueDate)}`}
                    />
                  ))
                ) : (
                  <ProjectStackItem
                    index="01"
                    title="先写一个今天能推进的动作"
                    detail="任务最好短到可以直接开始"
                  />
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
              <div>
                <p className="text-lg font-semibold tracking-tight">{activeProjects.length}</p>
                <p className="mt-0.5 text-[11px] text-white/54">活跃课题</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{allOpenTasks.length}</p>
                <p className="mt-0.5 text-[11px] text-white/54">待推进</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{completion}%</p>
                <p className="mt-0.5 text-[11px] text-white/54">完成度</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.36fr_0.64fr]">
        <aside className="grid content-start gap-4">
          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="size-4 text-primary" />
                下一步队列
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {nextTasks.length ? (
                nextTasks.map((task) => (
                  <NextTaskRow key={task.id} task={task} milestones={milestones} returnTo={returnTo} />
                ))
              ) : (
                <EmptyState
                  icon={ListTodo}
                  title="暂无待推进任务"
                  description="添加一条任务后，这里会自动按截止和优先级排序。"
                />
              )}
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Flag className="size-4 text-primary" />
                临近里程碑
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {nextMilestones.length ? (
                nextMilestones.map((milestone) => (
                  <MilestoneRow
                    key={milestone.id}
                    milestone={milestone}
                    projects={projects}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">没有未完成里程碑。</p>
              )}
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Search className="size-4 text-primary" />
                快捷视图
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <QuickProjectLink label="全部任务" count={quickBaseTasks.length} href={projectsHref(currentFilters, { status: undefined, priority: undefined, scope: undefined })} active={!status && !priority && !scope} />
              <QuickProjectLink label="今天/逾期" count={todayOpenTasks.length} href={projectsHref(currentFilters, { status: undefined, priority: undefined, scope: "today" })} active={scope === "today" && !status && !priority} />
              <QuickProjectLink label="高优先级" count={highOpenTasks.length} href={projectsHref(currentFilters, { status: undefined, priority: "high", scope: undefined })} active={priority === "high" && !status && !scope} />
              <QuickProjectLink label="进行中" count={doingTasks.length} href={projectsHref(currentFilters, { status: "doing", priority: undefined, scope: undefined })} active={status === "doing" && !priority && !scope} />
              <QuickProjectLink label="本周收口" count={weekOpenTasks.length} href={projectsHref(currentFilters, { status: undefined, priority: undefined, scope: "week" })} active={scope === "week" && !status && !priority} />
            </CardContent>
          </Card>
        </aside>

        <div className="grid gap-4">
          {taskBulk === "success" ? (
            <TaskBulkNotice
              href={returnTo}
              tone="success"
              title="任务状态已批量更新"
              description={`已将 ${taskBulkCount} 个任务标记为“${taskStatusLabel(taskBulkStatus ?? "")}”。`}
            />
          ) : null}

          {taskBulk === "empty" ? (
            <TaskBulkNotice
              href={returnTo}
              tone="error"
              title="没有选中任务"
              description="先勾选要处理的任务，再批量更新状态。"
            />
          ) : null}

          {taskSync === "success" ? (
            <TaskBulkNotice
              href="/projects?status=todo"
              tone="success"
              title="笔记清单已拆成任务"
              description={`已从笔记待办清单创建 ${taskSyncCount} 个项目任务。后续可以把它们挂到对应里程碑。`}
            />
          ) : null}

          {taskAttach === "success" ? (
            <TaskBulkNotice
              href={returnTo}
              tone="success"
              title="任务已挂到里程碑"
              description="它现在会出现在对应项目路线图里，后续推进不用再打开编辑弹窗。"
            />
          ) : null}

          {taskAttach === "error" ? (
            <TaskBulkNotice
              href={returnTo}
              tone="error"
              title="挂载失败"
              description="请选择一个有效里程碑后再保存。"
            />
          ) : null}

          {taskPlan === "empty" ? (
            <TaskBulkNotice
              href={returnTo}
              tone="error"
              title="没有可整理的任务"
              description="当前任务列表为空。先创建任务，或清除筛选后再生成推进笔记。"
            />
          ) : null}

          <form className="grid gap-2 rounded-2xl border border-border/72 bg-white/88 p-3 shadow-[0_12px_28px_rgba(27,42,56,0.045)] lg:grid-cols-[1fr_170px_130px_130px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" placeholder="搜索任务、里程碑、项目" defaultValue={q} className="pl-8" />
            </div>
            {scope ? <input type="hidden" name="scope" value={scope} /> : null}
            <select
              name="project"
              defaultValue={projectId ?? ""}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
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
            <select
              name="priority"
              defaultValue={priority ?? ""}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部优先级</option>
              <option value="high">高优先级</option>
              <option value="medium">中优先级</option>
              <option value="low">低优先级</option>
            </select>
            <Button type="submit" variant="outline">
              筛选
            </Button>
          </form>

          <div className="flex flex-col gap-3 rounded-2xl border border-border/72 bg-white/78 p-3 text-sm shadow-[0_10px_24px_rgba(34,48,71,0.04)] xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">当前任务 {tasks.length} 个</span>
              {selectedProjectTitle ? (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  {selectedProjectTitle}
                </span>
              ) : null}
              {status ? (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  {taskStatusLabel(status)}
                </span>
              ) : null}
              {priority ? (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  {priorityLabel(priority)}
                </span>
              ) : null}
              {scope ? (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  {scopeLabel(scope)}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
              {activeFilterCount ? (
                <Link
                  href="/projects"
                  className="inline-flex w-fit items-center gap-1 rounded-full border border-border/70 bg-white/82 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/25 hover:text-primary"
                >
                  <X className="size-3" />
                  清除 {activeFilterCount} 个筛选
                </Link>
              ) : (
                <span className="w-fit rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  未筛选
                </span>
              )}
              <form action={createProjectProgressNote} className="contents">
                <input type="hidden" name="returnTo" value={returnTo} />
                {tasks.slice(0, 12).map((task) => (
                  <input key={task.id} type="hidden" name="ids" value={task.id} />
                ))}
                <SubmitButton variant="outline" className="w-fit" disabled={!tasks.length}>
                  <ListChecks className="size-3.5" />
                  推进笔记
                </SubmitButton>
              </form>
              <form id="task-bulk-form" action={updateTaskStatuses} className="flex flex-wrap gap-2">
                <input type="hidden" name="returnTo" value={returnTo} />
                <select
                  name="status"
                  defaultValue="done"
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="todo">标为待办</option>
                  <option value="doing">标为进行中</option>
                  <option value="done">标为完成</option>
                </select>
                <SubmitButton variant="outline" className="w-fit">
                  批量更新
                </SubmitButton>
              </form>
            </div>
          </div>

          <section className="grid gap-3 lg:grid-cols-3">
            {taskColumns.map((column) => {
              const columnTasks = tasks.filter((task) => task.status === column.id);

              return (
                <Card key={column.id} className="workbench-card overflow-hidden">
                  <CardHeader className={`${column.tone} border-b border-border/70 pb-3`}>
                    <CardTitle className="flex items-start justify-between gap-3 text-base">
                      <span>
                        {column.label}
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">
                          {column.hint}
                        </span>
                      </span>
                      <span className="rounded-full border bg-white/80 px-2 py-0.5 text-xs text-muted-foreground">
                        {columnTasks.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {columnTasks.length ? (
                      columnTasks.map((task) => (
                        <TaskCard key={task.id} task={task} milestones={milestones} returnTo={returnTo} />
                      ))
                    ) : (
                      <p className="rounded-xl border border-dashed bg-muted/25 p-4 text-center text-sm text-muted-foreground">
                        {activeFilterCount ? "当前筛选下无任务" : `暂无${column.label}任务`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <section className="grid gap-3">
            {projects.length ? (
              projects.map((project) => (
                <ProjectRoadmapCard
                  key={project.id}
                  project={project}
                  projects={projects}
                  milestones={milestones}
                />
              ))
            ) : (
              <EmptyState
                icon={FolderKanban}
                title="暂无项目"
                description="创建课题后，再把里程碑、任务和实验记录挂上去。"
              />
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function TaskBulkNotice({
  tone,
  title,
  description,
  href,
}: {
  tone: "success" | "error";
  title: string;
  description: string;
  href: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <Card
      className={
        tone === "success"
          ? "border-emerald-200 bg-[#eefaf4] shadow-sm"
          : "border-rose-200 bg-[#fff1f2] shadow-sm"
      }
    >
      <CardContent className="flex flex-col gap-3 py-4 text-sm md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <span
            className={
              tone === "success"
                ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"
                : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700"
            }
          >
            <Icon className="size-4" />
          </span>
          <div>
            <p className={tone === "success" ? "font-medium text-emerald-950" : "font-medium text-rose-950"}>
              {title}
            </p>
            <p className={tone === "success" ? "mt-1 text-emerald-900/80" : "mt-1 text-rose-900/80"}>
              {description}
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex h-9 w-fit items-center rounded-lg border border-border/72 bg-white/82 px-3 text-sm font-medium transition hover:border-primary/30 hover:text-primary"
        >
          关闭提示
        </Link>
      </CardContent>
    </Card>
  );
}

function ProjectStackItem({
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

function QuickProjectLink({
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

function NextTaskRow({
  task,
  milestones,
  returnTo,
}: {
  task: TaskFull;
  milestones: MilestoneFull[];
  returnTo: string;
}) {
  const nextAction = taskActionLabel(task);

  return (
    <div className="soft-tile rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-1 font-medium">{task.title}</p>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {task.milestone?.project.title ?? "独立任务"} · {dueText(task.dueDate)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge value={task.priority} kind="priority" />
          <span className="rounded-md border border-[#d8e5ee] bg-[#eef4fb] px-1.5 py-0.5 text-[11px] text-[#365a7d]">
            {nextAction}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TaskMoveForm task={task} compact />
        <TaskMilestoneAttachForm task={task} milestones={milestones} returnTo={returnTo} compact />
        <CreateExperimentFromTaskButton task={task} compact />
        <CreateDialog title="编辑任务" label="编辑" icon={Edit3} wide>
          <TaskForm action={updateTask} milestones={milestones} task={task} />
        </CreateDialog>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  milestones,
  returnTo,
}: {
  task: TaskFull;
  milestones: MilestoneFull[];
  returnTo: string;
}) {
  const nextAction = taskActionLabel(task);

  return (
    <div className="soft-tile rounded-xl p-3 transition hover:border-primary/25 hover:bg-white hover:shadow-[0_10px_24px_rgba(27,42,56,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2">
          <input
            form="task-bulk-form"
            type="checkbox"
            name="ids"
            value={task.id}
            aria-label={`选择任务：${task.title}`}
            className="mt-1 size-4 shrink-0 rounded border-border text-primary accent-[var(--primary)]"
          />
          <div className="min-w-0">
            <p className="line-clamp-2 font-medium leading-snug">{task.title}</p>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {task.milestone?.project.title ?? "独立任务"} · {formatDate(task.dueDate)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge value={task.priority} kind="priority" />
          <span className="rounded-md border border-[#d8e5ee] bg-[#eef4fb] px-1.5 py-0.5 text-[11px] text-[#365a7d]">
            {nextAction}
          </span>
        </div>
      </div>
      {task.description ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {task.description}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TaskMoveForm task={task} />
        <TaskMilestoneAttachForm task={task} milestones={milestones} returnTo={returnTo} />
        {task.status !== "done" ? <CreateExperimentFromTaskButton task={task} /> : null}
        <CreateDialog title="编辑任务" label="编辑" icon={Edit3} wide>
          <TaskForm action={updateTask} milestones={milestones} task={task} />
        </CreateDialog>
        <form action={deleteTask}>
          <input type="hidden" name="id" value={task.id} />
          <Button type="submit" variant="destructive" size="sm">
            <Trash2 className="size-3.5" />
            删除
          </Button>
        </form>
      </div>
    </div>
  );
}

function TaskMilestoneAttachForm({
  task,
  milestones,
  returnTo,
  compact = false,
}: {
  task: Task;
  milestones: MilestoneFull[];
  returnTo: string;
  compact?: boolean;
}) {
  if (task.milestoneId || !milestones.length) {
    return null;
  }

  return (
    <form
      action={attachTaskToMilestone}
      className="flex min-w-0 max-w-full flex-wrap gap-1.5 rounded-lg border border-dashed border-[#c9d9de] bg-white/70 p-1"
    >
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <select
        name="milestoneId"
        required
        defaultValue=""
        aria-label="挂到里程碑"
        className={`${compact ? "h-7" : "h-8"} min-w-0 max-w-[190px] rounded-md border border-transparent bg-transparent px-2 text-xs text-[#315266] outline-none transition focus:border-primary/30 focus:bg-white`}
      >
        <option value="">挂到里程碑</option>
        {milestones.map((milestone) => (
          <option key={milestone.id} value={milestone.id}>
            {milestone.project.title} / {milestone.title}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm">
        <Flag className="size-3.5" />
        保存
      </Button>
    </form>
  );
}

function CreateExperimentFromTaskButton({
  task,
  compact = false,
}: {
  task: Task;
  compact?: boolean;
}) {
  return (
    <form action={createExperimentFromTask}>
      <input type="hidden" name="id" value={task.id} />
      <Button type="submit" variant="outline" size="sm">
        <Beaker className="size-3.5" />
        {compact ? "转实验" : "转成实验"}
      </Button>
    </form>
  );
}

function TaskMoveForm({ task, compact = false }: { task: Task; compact?: boolean }) {
  return (
    <form action={setTaskStatus} className="flex gap-1.5">
      <input type="hidden" name="id" value={task.id} />
      <select
        name="status"
        defaultValue={task.status}
        className="h-7 rounded-lg border bg-background px-2 text-xs"
        aria-label="任务状态"
      >
        <option value="todo">待办</option>
        <option value="doing">进行中</option>
        <option value="done">完成</option>
      </select>
      <Button type="submit" variant="outline" size="sm">
        {compact ? "移动" : "更新"}
      </Button>
    </form>
  );
}

function taskStatusLabel(value: string) {
  const labels: Record<string, string> = {
    todo: "待办",
    doing: "进行中",
    done: "完成",
  };

  return labels[value] ?? value;
}

function priorityLabel(value: string) {
  const labels: Record<string, string> = {
    high: "高优先级",
    medium: "中优先级",
    low: "低优先级",
  };

  return labels[value] ?? value;
}

function scopeLabel(value: string) {
  const labels: Record<string, string> = {
    today: "今天/逾期",
    week: "本周/逾期",
  };

  return labels[value] ?? value;
}

function projectsHref(
  current: {
    q?: string;
    project?: string;
    status?: string;
    priority?: string;
    scope?: string;
  },
  patch: Partial<{
    q: string;
    project: string;
    status: string;
    priority: string;
    scope: string;
  }>,
) {
  const params = new URLSearchParams();
  const next = { ...current, ...patch };

  Object.entries(next).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const query = params.toString();
  return query ? `/projects?${query}` : "/projects";
}

function taskMatchesProjectBase(task: TaskFull, q?: string, projectId?: string) {
  if (projectId && task.milestone?.projectId !== projectId) {
    return false;
  }

  if (!q) {
    return true;
  }

  const keyword = q.toLowerCase();
  return [
    task.title,
    task.description,
    task.tags,
    task.milestone?.title,
    task.milestone?.project.title,
  ].some((value) => value?.toLowerCase().includes(keyword));
}

function taskActionLabel(task: Task) {
  if (task.status === "done") {
    return "已收口";
  }

  if (!task.milestoneId) {
    return "补里程碑";
  }

  const distance = daysUntil(task.dueDate);
  if (distance !== null && distance < 0) {
    return "先补逾期";
  }

  if (task.status === "doing") {
    return "继续推进";
  }

  if (task.priority === "high") {
    return "优先处理";
  }

  return "开始推进";
}

function MilestoneRow({
  milestone,
  projects,
}: {
  milestone: MilestoneFull;
  projects: Project[];
}) {
  const done = milestone.tasks.filter((task) => task.status === "done").length;
  const total = milestone.tasks.length;

  return (
    <div className="soft-tile rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-1 font-medium">{milestone.title}</p>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {milestone.project.title} · {dueText(milestone.dueDate)}
          </p>
        </div>
        <StatusBadge value={milestone.status} />
      </div>
      <div className="mt-3 grid gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>任务完成</span>
          <span>{done}/{total || 0}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/72"
            style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <CreateDialog title="编辑里程碑" label="编辑" icon={Edit3}>
          <MilestoneForm
            action={updateMilestone}
            projects={projects}
            milestone={milestone}
          />
        </CreateDialog>
        <form action={deleteMilestone}>
          <input type="hidden" name="id" value={milestone.id} />
          <Button type="submit" variant="destructive" size="sm">
            <Trash2 className="size-3.5" />
            删除
          </Button>
        </form>
      </div>
    </div>
  );
}

function ProjectRoadmapCard({
  project,
  projects,
  milestones,
}: {
  project: ProjectFull;
  projects: Project[];
  milestones: MilestoneFull[];
}) {
  const projectTasks = project.milestones.flatMap((milestone) => milestone.tasks);
  const done = projectTasks.filter((task) => task.status === "done").length;
  const total = projectTasks.length;
  const progress = total ? Math.round((done / total) * 100) : 0;

  return (
    <Card className="workbench-card overflow-hidden">
      <CardContent className="grid gap-4 py-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={project.status} />
              <h2 className="line-clamp-1 text-base font-semibold">{project.title}</h2>
              <span className="rounded-md border bg-white/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {project.milestones.length} 个里程碑 · {project.experiments.length} 条实验
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {project.description ?? "暂无一句话目标。建议写成：我想验证什么，以及近期交付物是什么。"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CreateDialog title="编辑项目" label="编辑" icon={Edit3}>
              <ProjectForm action={updateProject} project={project} />
            </CreateDialog>
            <form action={deleteProject}>
              <input type="hidden" name="id" value={project.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="size-3.5" />
                删除
              </Button>
            </form>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>项目推进</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/72" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <TagList value={project.tags} />
        </div>

        {project.milestones.length ? (
          <div className="grid gap-2">
            {project.milestones.map((milestone) => (
              <ProjectMilestoneStrip
                key={milestone.id}
                milestone={milestone}
                projects={projects}
                milestones={milestones}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/25 p-4 text-sm text-muted-foreground">
            还没有里程碑。先把课题切成一个可以验收的小阶段。
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectMilestoneStrip({
  milestone,
  projects,
  milestones,
}: {
  milestone: Milestone & { tasks: Task[] };
  projects: Project[];
  milestones: MilestoneFull[];
}) {
  const nextTask = milestone.tasks.find((task) => task.status !== "done");
  const done = milestone.tasks.filter((task) => task.status === "done").length;

  return (
    <div className="grid gap-3 soft-tile rounded-xl p-3 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={milestone.status} />
          <p className="line-clamp-1 font-medium">{milestone.title}</p>
          <span className="text-xs text-muted-foreground">{dueText(milestone.dueDate)}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {nextTask ? `下一步：${nextTask.title}` : "这个阶段暂时没有未完成任务"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg border bg-white/80 px-2.5 py-1 text-xs text-muted-foreground">
          {done}/{milestone.tasks.length || 0} 完成
        </span>
        <CreateDialog title="编辑里程碑" label="里程碑" icon={Edit3}>
          <MilestoneForm
            action={updateMilestone}
            projects={projects}
            milestone={milestone}
          />
        </CreateDialog>
        <CreateDialog title="添加任务" label="加任务" icon={Plus} wide>
          <TaskForm
            action={createTask}
            milestones={milestones}
            defaultMilestoneId={milestone.id}
          />
        </CreateDialog>
      </div>
    </div>
  );
}

function ProjectForm({
  action,
  project,
}: {
  action: (formData: FormData) => Promise<void>;
  project?: Project;
}) {
  return (
    <form action={action} className="grid gap-3">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <Field label="项目名">
        <Input name="title" required defaultValue={project?.title ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="状态">
          <select
            name="status"
            defaultValue={project?.status ?? "active"}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="active">进行中</option>
            <option value="paused">暂停</option>
            <option value="archived">归档</option>
          </select>
        </Field>
        <Field label="标签">
          <Input
            name="tags"
            placeholder="例如：论文, 实验, 毕设"
            defaultValue={parseTags(project?.tags).join(", ")}
          />
        </Field>
      </div>
      <Field label="一句话目标">
        <Textarea
          name="description"
          rows={3}
          placeholder="这个课题近期要验证什么？交付物是什么？"
          defaultValue={project?.description ?? ""}
        />
      </Field>
      <SubmitButton>{project ? "保存项目" : "创建项目"}</SubmitButton>
    </form>
  );
}

function MilestoneForm({
  action,
  projects,
  milestone,
}: {
  action: (formData: FormData) => Promise<void>;
  projects: Project[];
  milestone?: Milestone;
}) {
  return (
    <form action={action} className="grid gap-3">
      {milestone ? <input type="hidden" name="id" value={milestone.id} /> : null}
      <Field label="项目">
        <select
          name="projectId"
          required
          defaultValue={milestone?.projectId ?? ""}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">选择项目</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="里程碑">
        <Input name="title" required defaultValue={milestone?.title ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="截止日期">
          <Input
            name="dueDate"
            type="date"
            defaultValue={milestone?.dueDate ? milestone.dueDate.toISOString().slice(0, 10) : ""}
          />
        </Field>
        <Field label="状态">
          <select
            name="status"
            defaultValue={milestone?.status ?? "planned"}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="planned">计划中</option>
            <option value="running">进行中</option>
            <option value="completed">完成</option>
          </select>
        </Field>
      </div>
      <SubmitButton>{milestone ? "保存里程碑" : "创建里程碑"}</SubmitButton>
    </form>
  );
}

function TaskForm({
  action,
  milestones,
  task,
  defaultMilestoneId,
}: {
  action: (formData: FormData) => Promise<void>;
  milestones: MilestoneFull[];
  task?: Task;
  defaultMilestoneId?: string;
}) {
  return (
    <form action={action} className="grid gap-3">
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      <Field label="任务">
        <Input
          name="title"
          required
          placeholder="例如：整理第三组实验结果"
          defaultValue={task?.title ?? ""}
        />
      </Field>
      <Field label="归属里程碑">
        <select
          name="milestoneId"
          defaultValue={task?.milestoneId ?? defaultMilestoneId ?? ""}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">独立任务</option>
          {milestones.map((milestone) => (
            <option key={milestone.id} value={milestone.id}>
              {milestone.project.title} / {milestone.title}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="优先级">
          <select
            name="priority"
            defaultValue={task?.priority ?? "medium"}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </Field>
        <Field label="状态">
          <select
            name="status"
            defaultValue={task?.status ?? "todo"}
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
            defaultValue={task?.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
          />
        </Field>
      </div>
      <Field label="备注">
        <Textarea
          name="description"
          rows={4}
          placeholder="只写必要上下文，例如数据、文献或验收标准。"
          defaultValue={task?.description ?? ""}
        />
      </Field>
      <SubmitButton>{task ? "保存任务" : "创建任务"}</SubmitButton>
    </form>
  );
}

function taskRank(task: Task) {
  const due = daysUntil(task.dueDate);
  const priority = { high: 0, medium: 1, low: 2 }[task.priority] ?? 1;
  const status = { doing: 0, todo: 1, done: 9 }[task.status] ?? 1;
  return status * 10000 + (due ?? 999) * 10 + priority;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
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
