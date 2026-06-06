import { BarChart3, Trash2 } from "lucide-react";
import type { Milestone, Project, Task } from "@prisma/client";

import {
  createMilestone,
  createProject,
  createTask,
  deleteMilestone,
  deleteProject,
  deleteTask,
  setTaskStatus,
  updateProject,
  updateTask,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDate, parseTags } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type ProjectFull = Project & {
  milestones: Array<Milestone & { tasks: Task[] }>;
  experiments: { id: string }[];
};

export default async function ProjectsPage() {
  const [projects, milestones, tasks] = await Promise.all([
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        milestones: { include: { tasks: true }, orderBy: { dueDate: "asc" } },
        experiments: { select: { id: true } },
      },
    }),
    prisma.milestone.findMany({
      orderBy: { dueDate: "asc" },
      include: { project: true },
    }),
    prisma.task.findMany({
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      include: { milestone: { include: { project: true } } },
    }),
  ]);

  const columns = [
    { id: "todo", label: "待办" },
    { id: "doing", label: "进行中" },
    { id: "done", label: "完成" },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Progress Tracker"
        title="项目 / 里程碑 / 任务"
        description="看板优先于复杂甘特图：先把项目推进状态讲清楚，再逐步增强时间线视图。"
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>新建项目</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectForm action={createProject} />
          </CardContent>
        </Card>
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>新建里程碑</CardTitle>
          </CardHeader>
          <CardContent>
            <MilestoneForm projects={projects} />
          </CardContent>
        </Card>
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>新建任务</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskForm action={createTask} milestones={milestones} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => (
          <Card key={column.id} className="rounded-lg bg-white/95">
            <CardHeader>
              <CardTitle>{column.label}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {tasks
                .filter((task) => task.status === column.id)
                .map((task) => (
                  <div key={task.id} className="rounded-lg border bg-[#fffdf7] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.milestone?.project.title ?? "独立任务"} ·{" "}
                          {formatDate(task.dueDate)}
                        </p>
                      </div>
                      <StatusBadge value={task.priority} kind="priority" />
                    </div>
                    <form action={setTaskStatus} className="mt-3 flex gap-2">
                      <input type="hidden" name="id" value={task.id} />
                      <select
                        name="status"
                        defaultValue={task.status}
                        className="h-8 rounded-lg border bg-background px-2 text-sm"
                      >
                        <option value="todo">待办</option>
                        <option value="doing">进行中</option>
                        <option value="done">完成</option>
                      </select>
                      <Button type="submit" variant="outline">
                        移动
                      </Button>
                    </form>
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted-foreground">编辑</summary>
                      <div className="mt-3">
                        <TaskForm action={updateTask} milestones={milestones} task={task} />
                        <form action={deleteTask} className="mt-2">
                          <input type="hidden" name="id" value={task.id} />
                          <Button type="submit" variant="destructive">
                            <Trash2 className="size-4" />
                            删除
                          </Button>
                        </form>
                      </div>
                    </details>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-3">
        {projects.length ? (
          projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))
        ) : (
          <EmptyState
            icon={BarChart3}
            title="暂无项目"
            description="创建研究课题后，再挂载里程碑、任务和实验记录。"
          />
        )}
      </section>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectFull }) {
  return (
    <Card className="rounded-lg bg-white/95">
      <CardContent className="grid gap-4 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{project.title}</h2>
              <StatusBadge value={project.status} />
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {project.description ?? "暂无项目描述。"}
            </p>
          </div>
          <TagList value={project.tags} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {project.milestones.map((milestone) => (
            <div key={milestone.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{milestone.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(milestone.dueDate)}
                  </p>
                </div>
                <StatusBadge value={milestone.status} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {milestone.tasks.length} 个任务
              </p>
              <form action={deleteMilestone} className="mt-2">
                <input type="hidden" name="id" value={milestone.id} />
                <Button type="submit" variant="ghost">
                  删除里程碑
                </Button>
              </form>
            </div>
          ))}
        </div>
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">编辑项目</summary>
          <div className="mt-3">
            <ProjectForm action={updateProject} project={project} />
            <form action={deleteProject} className="mt-3">
              <input type="hidden" name="id" value={project.id} />
              <Button type="submit" variant="destructive">
                <Trash2 className="size-4" />
                删除项目
              </Button>
            </form>
          </div>
        </details>
      </CardContent>
    </Card>
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
        <Input name="tags" defaultValue={parseTags(project?.tags).join(", ")} />
      </Field>
      <Field label="描述">
        <Textarea name="description" rows={4} defaultValue={project?.description ?? ""} />
      </Field>
      <SubmitButton>{project ? "保存项目" : "创建项目"}</SubmitButton>
    </form>
  );
}

function MilestoneForm({ projects }: { projects: Project[] }) {
  return (
    <form action={createMilestone} className="grid gap-3">
      <Field label="项目">
        <select name="projectId" required className="h-8 rounded-lg border bg-background px-2 text-sm">
          <option value="">选择项目</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="里程碑">
        <Input name="title" required />
      </Field>
      <Field label="截止日期">
        <Input name="dueDate" type="date" />
      </Field>
      <Field label="状态">
        <select name="status" className="h-8 rounded-lg border bg-background px-2 text-sm">
          <option value="planned">计划中</option>
          <option value="running">进行中</option>
          <option value="completed">完成</option>
        </select>
      </Field>
      <SubmitButton>创建里程碑</SubmitButton>
    </form>
  );
}

function TaskForm({
  action,
  milestones,
  task,
}: {
  action: (formData: FormData) => Promise<void>;
  milestones: Array<Milestone & { project: Project }>;
  task?: Task;
}) {
  return (
    <form action={action} className="grid gap-3">
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      <Field label="任务">
        <Input name="title" required defaultValue={task?.title ?? ""} />
      </Field>
      <Field label="里程碑">
        <select
          name="milestoneId"
          defaultValue={task?.milestoneId ?? ""}
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
      <Field label="标签">
        <Input name="tags" defaultValue={parseTags(task?.tags).join(", ")} />
      </Field>
      <Field label="描述">
        <Textarea name="description" rows={3} defaultValue={task?.description ?? ""} />
      </Field>
      <SubmitButton>{task ? "保存任务" : "创建任务"}</SubmitButton>
    </form>
  );
}
