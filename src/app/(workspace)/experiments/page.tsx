import Link from "next/link";
import {
  ClipboardList,
  Beaker,
  Edit3,
  FileChartColumn,
  FileText,
  FlaskConical,
  Link2,
  Microscope,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Experiment, Paper, Prisma, Project } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  appendResultToExperiment,
  createExperiment,
  createExperimentReviewNote,
  createExperimentReviewTask,
  deleteExperiment,
  setExperimentStatus,
  updateExperiment,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { ExperimentForm } from "@/components/experiments/experiment-form";
import { EXPERIMENT_TEMPLATES, experimentTemplateLabel } from "@/lib/experiment-templates";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateDialog } from "@/components/shared/create-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    q?: string;
    project?: string;
    status?: string;
    template?: string;
  }>;
};

type ExperimentFull = Experiment & {
  project: Project | null;
  papers: Paper[];
  results: { id: string; title: string; updatedAt: Date }[];
};

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ExperimentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = valueOf(params.q)?.trim();
  const projectId = valueOf(params.project);
  const status = valueOf(params.status);
  const template = valueOf(params.template);
  const activeFilterCount = [q, projectId, status, template].filter(Boolean).length;

  const where: Prisma.ExperimentWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
      { tags: { contains: q, mode: "insensitive" } },
      { project: { title: { contains: q, mode: "insensitive" } } },
      { papers: { some: { title: { contains: q, mode: "insensitive" } } } },
    ];
  }
  if (projectId) {
    where.projectId = projectId;
  }
  if (status && ["running", "completed", "failed", "abandoned"].includes(status)) {
    where.status = status;
  }
  if (template && EXPERIMENT_TEMPLATES.some((item) => item.value === template)) {
    where.template = template;
  }

  const [experiments, projects, papers] = await Promise.all([
    prisma.experiment.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        project: true,
        papers: true,
        results: {
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, updatedAt: true },
        },
      },
    }),
    prisma.project.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.paper.findMany({ orderBy: { updatedAt: "desc" } }),
  ]);

  const running = experiments.filter((experiment) => experiment.status === "running").length;
  const completed = experiments.filter((experiment) => experiment.status === "completed").length;
  const failed = experiments.filter((experiment) => experiment.status === "failed").length;
  const selectedProjectTitle = projects.find((project) => project.id === projectId)?.title;
  const experimentStack = [
    ...experiments.filter((experiment) => experiment.status === "running"),
    ...experiments.filter((experiment) => experiment.status === "failed"),
  ].slice(0, 3);

  return (
    <div className="grid gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="research-eyebrow">
                <Microscope className="size-3.5" />
                实验日志
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                目的 · 观察 · 结论 · 下一步
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              每次实验只留下能复盘的东西。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              不把实验记录做成参数仓库。这里更像一个轻量 ELN：用模板帮你写清楚目的、
              方法、观察、结论和下一步，再把项目、文献和结果连起来。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <CreateDialog
                title="新建实验"
                description="写清楚实验目的、关键方法、观察结果和下一步。"
                label="新建实验"
                icon={Plus}
                wide
              >
                <ExperimentForm
                  action={createExperiment}
                  projects={projects}
                  papers={papers}
                />
              </CreateDialog>
              <Link href="/data" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-white/88 px-3 text-sm font-medium shadow-[0_1px_1px_rgba(15,23,42,0.04)] transition hover:border-primary/30 hover:bg-white">
                <FileChartColumn className="size-4" />
                记录结果
              </Link>
            </div>
          </div>

          <div className="flex min-h-64 flex-col justify-between rounded-2xl action-stack p-4 text-white shadow-[0_18px_36px_rgba(22,34,53,0.16)]">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-white/68">
                <FlaskConical className="size-3.5" />
                今日实验栈
              </p>
              <div className="mt-4 grid gap-2.5">
                {experimentStack.length ? (
                  experimentStack.map((experiment, index) => (
                    <ExperimentStackItem
                      key={experiment.id}
                      index={`0${index + 1}`}
                      title={experiment.title}
                      detail={`${statusLabel(experiment.status)} · ${experiment.project?.title ?? "未关联项目"}`}
                    />
                  ))
                ) : (
                  <ExperimentStackItem
                    index="01"
                    title="先记录一个正在做的实验"
                    detail="写目的、方法、观察和下一步"
                  />
                )}
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-white/62">
              先收口进行中和失败实验，再把关键结果回填到正文。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.28fr_0.72fr]">
        <aside className="grid content-start gap-4">
          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Beaker className="size-4 text-primary" />
                实验模板
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {EXPERIMENT_TEMPLATES.map((template) => (
                <TemplateHint key={template.value} title={template.label} detail={template.detail} />
              ))}
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle>状态分布</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ProgressLine label="进行中" value={running} total={experiments.length} />
              <ProgressLine label="完成" value={completed} total={experiments.length} />
              <ProgressLine label="失败" value={failed} total={experiments.length} />
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
              <QuickStatusLink label="全部实验" count={experiments.length} statusValue="" currentStatus={status} q={q} projectId={projectId} template={template} />
              <QuickStatusLink label="继续观察" count={running} statusValue="running" currentStatus={status} q={q} projectId={projectId} template={template} />
              <QuickStatusLink label="已完成" count={completed} statusValue="completed" currentStatus={status} q={q} projectId={projectId} template={template} />
              <QuickStatusLink label="失败复盘" count={failed} statusValue="failed" currentStatus={status} q={q} projectId={projectId} template={template} />
            </CardContent>
          </Card>
        </aside>

        <div className="grid gap-3">
          <form className="grid gap-2 rounded-2xl border border-border/72 bg-white/88 p-3 shadow-[0_12px_28px_rgba(27,42,56,0.045)] lg:grid-cols-[1fr_170px_130px_170px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" placeholder="搜索标题、正文、项目、论文" defaultValue={q} className="pl-8" />
            </div>
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
              <option value="running">进行中</option>
              <option value="completed">完成</option>
              <option value="failed">失败</option>
              <option value="abandoned">放弃</option>
            </select>
            <select
              name="template"
              defaultValue={template ?? ""}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部模板</option>
              {EXPERIMENT_TEMPLATES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              筛选
            </Button>
          </form>

          <div className="flex flex-col gap-2 rounded-2xl border border-border/72 bg-white/78 p-3 text-sm shadow-[0_10px_24px_rgba(34,48,71,0.04)] md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">当前列表 {experiments.length} 条</span>
              {selectedProjectTitle ? (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  {selectedProjectTitle}
                </span>
              ) : null}
              {status ? (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  {statusLabel(status)}
                </span>
              ) : null}
              {template ? (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  {templateLabel(template)}
                </span>
              ) : null}
            </div>
            {activeFilterCount ? (
              <Link
                href="/experiments"
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
          </div>

          {experiments.length ? (
            experiments.map((experiment) => (
              <ExperimentCard
                key={experiment.id}
                experiment={experiment}
                projects={projects}
                papers={papers}
              />
            ))
          ) : (
            <EmptyState
              icon={FlaskConical}
              title={activeFilterCount ? "没有匹配的实验记录" : "暂无实验记录"}
              description={
                activeFilterCount
                  ? "试着清除筛选，或换一个项目、状态、模板再看。"
                  : "先建立第一条实验记录，把目的、方法、观察和结论写下来。"
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

function TemplateHint({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="soft-tile rounded-xl p-3">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ProgressLine({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total ? Math.round((value / total) * 100) : 0;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/72" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ExperimentStackItem({
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

function QuickStatusLink({
  label,
  count,
  statusValue,
  currentStatus,
  q,
  projectId,
  template,
}: {
  label: string;
  count: number;
  statusValue: string;
  currentStatus?: string;
  q?: string;
  projectId?: string;
  template?: string;
}) {
  const active = statusValue ? currentStatus === statusValue : !currentStatus;
  const href = `/experiments?${experimentFilterQuery({
    q,
    project: projectId,
    status: statusValue || undefined,
    template,
  })}`;

  return (
    <Link
      href={href === "/experiments?" ? "/experiments" : href}
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

function experimentFilterQuery(values: {
  q?: string;
  project?: string;
  status?: string;
  template?: string;
}) {
  const params = new URLSearchParams();
  if (values.q) params.set("q", values.q);
  if (values.project) params.set("project", values.project);
  if (values.status) params.set("status", values.status);
  if (values.template) params.set("template", values.template);
  return params.toString();
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    running: "进行中",
    completed: "完成",
    failed: "失败",
    abandoned: "放弃",
  };

  return labels[value] ?? value;
}

function ExperimentCard({
  experiment,
  projects,
  papers,
}: {
  experiment: ExperimentFull;
  projects: Project[];
  papers: Paper[];
}) {
  const linkedPapers = experiment.papers.map((paper) => paper.title).join("；");
  const nextAction =
    experiment.status === "failed"
      ? "复盘失败"
      : experiment.results.length
        ? "补结果"
        : experiment.status === "completed"
          ? "沉淀结论"
          : "继续观察";

  return (
    <Card className="workbench-card">
      <CardContent className="grid gap-4 py-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={experiment.status} />
              <span className="rounded-md border bg-white/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {templateLabel(experiment.template)}
              </span>
              <span className="rounded-md border border-[#d8e5ee] bg-[#eef4fb] px-1.5 py-0.5 text-[11px] text-[#365a7d]">
                {nextAction}
              </span>
            </div>
            <h2 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">
              {experiment.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {experiment.project?.title ?? "未关联项目"} · 更新 {formatDateTime(experiment.updatedAt)}
            </p>
          </div>
          <form action={setExperimentStatus} className="flex flex-wrap gap-2 lg:justify-end">
            <input type="hidden" name="id" value={experiment.id} />
            <select
              name="status"
              defaultValue={experiment.status}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="running">进行中</option>
              <option value="completed">完成</option>
              <option value="failed">失败</option>
              <option value="abandoned">放弃</option>
            </select>
            <Button type="submit" variant="outline" size="sm">
              更新
            </Button>
          </form>
        </div>

        {experiment.status === "failed" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">这条失败实验值得复盘</p>
                <p className="mt-1 text-xs leading-5 text-amber-900/80">
                  生成一个高优先级复盘任务，去项目页继续拆解原因、对照和下一次实验修改。
                </p>
              </div>
              <form action={createExperimentReviewTask}>
                <input type="hidden" name="id" value={experiment.id} />
                <SubmitButton variant="outline" className="bg-white/82">
                  <ClipboardList className="size-4" />
                  生成复盘任务
                </SubmitButton>
              </form>
            </div>
          </div>
        ) : null}

        <div className="soft-tile rounded-xl p-4 text-sm leading-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {experiment.content || "暂无实验内容。建议至少写下：目的、方法、观察、结论和下一步。"}
          </ReactMarkdown>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoBlock
            icon={Link2}
            label="关联论文"
            value={linkedPapers || "暂无"}
          />
          <ExperimentResultActions experiment={experiment} />
        </div>

        <div className="flex flex-col gap-3 border-t border-border/65 pt-3 md:flex-row md:items-center md:justify-between">
          <TagList value={experiment.tags} />
          <div className="flex flex-wrap items-center gap-2">
            <form action={createExperimentReviewNote}>
              <input type="hidden" name="id" value={experiment.id} />
              <Button type="submit" variant="outline" size="sm">
                <FileText className="size-4" />
                复盘笔记
              </Button>
            </form>
            <CreateDialog title="编辑实验" label="编辑" icon={Edit3} wide>
              <ExperimentForm
                action={updateExperiment}
                projects={projects}
                papers={papers}
                experiment={experiment}
              />
            </CreateDialog>
            <form action={deleteExperiment}>
              <input type="hidden" name="id" value={experiment.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="size-4" />
                删除
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExperimentResultActions({ experiment }: { experiment: ExperimentFull }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/72 bg-white/70 p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eef4f2] text-primary">
        <FileChartColumn className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">结果记录</p>
        {experiment.results.length ? (
          <div className="mt-2 grid gap-2">
            {experiment.results.slice(0, 3).map((result) => (
              <div key={result.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{result.title}</span>
                <form action={appendResultToExperiment}>
                  <input type="hidden" name="id" value={result.id} />
                  <Button type="submit" variant="outline" size="sm">
                    回填正文
                  </Button>
                </form>
              </div>
            ))}
            {experiment.results.length > 3 ? (
              <p className="text-xs text-muted-foreground">
                还有 {experiment.results.length - 3} 条结果，可到成果页查看。
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-sm">暂无</p>
        )}
      </div>
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/72 bg-white/70 p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eef4f2] text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 line-clamp-2 text-sm">{value}</p>
      </div>
    </div>
  );
}

const templateLabel = experimentTemplateLabel;
