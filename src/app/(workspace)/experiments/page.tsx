import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  Beaker,
  CheckCircle2,
  Edit3,
  FileChartColumn,
  FileText,
  FlaskConical,
  Link2,
  Microscope,
  Plus,
  RotateCcw,
  Search,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import type { Experiment, Paper, Prisma, Project } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  appendResultToExperiment,
  createExperiment,
  createExperimentCloseoutNote,
  createExperimentReviewNote,
  createExperimentReviewTask,
  createResultFromExperiment,
  deleteExperiment,
  setExperimentStatus,
  updateExperiment,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { ExperimentForm } from "@/components/experiments/experiment-form";
import { EXPERIMENT_TEMPLATES, experimentTemplateLabel } from "@/lib/experiment-templates";
import { EmptyState } from "@/components/shared/empty-state";
import { CaptureNotice } from "@/components/shared/capture-notice";
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
    captured?: string;
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
  const now = new Date();
  const q = valueOf(params.q)?.trim();
  const projectId = valueOf(params.project);
  const status = valueOf(params.status);
  const template = valueOf(params.template);
  const captured = valueOf(params.captured);
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

  const [experiments, projects, papers, closeoutCandidates] = await Promise.all([
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
    prisma.experiment.findMany({
      where: {
        OR: [
          { status: "failed" },
          { status: "running" },
          { status: "completed", results: { none: {} } },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: 18,
      include: {
        project: true,
        papers: true,
        results: {
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, updatedAt: true },
        },
      },
    }),
  ]);

  const running = experiments.filter((experiment) => experiment.status === "running").length;
  const completed = experiments.filter((experiment) => experiment.status === "completed").length;
  const failed = experiments.filter((experiment) => experiment.status === "failed").length;
  const selectedProjectTitle = projects.find((project) => project.id === projectId)?.title;
  const experimentStack = prioritizeExperimentCloseout(closeoutCandidates).slice(0, 3);
  const totalCloseoutCount = closeoutCandidates.length;
  const staleRunningCount = experiments.filter(
    (experiment) =>
      experiment.status === "running" &&
      now.getTime() - experiment.updatedAt.getTime() > 7 * 86_400_000,
  ).length;
  const completedWithoutResultCount = experiments.filter(
    (experiment) => experiment.status === "completed" && experiment.results.length === 0,
  ).length;
  const experimentsWithEvidenceCount = experiments.filter((experiment) => experiment.results.length > 0).length;
  const unresolvedExperimentCount = experiments.filter(
    (experiment) =>
      experiment.status === "running" ||
      experiment.status === "failed" ||
      (experiment.status === "completed" && experiment.results.length === 0),
  ).length;
  const reproducibilitySignals = [
    {
      detail: staleRunningCount ? `${staleRunningCount} 个超过 7 天未更新，建议先补观察。` : "正在跑的实验先补最新观察和下一步。",
      href: experimentHref({ q, project: projectId, status: "running", template }),
      icon: FlaskConical,
      label: "继续观察",
      tone: "running" as const,
      value: `${running} 个`,
    },
    {
      detail: "失败实验要先变成原因、对照和下一次修改。",
      href: experimentHref({ q, project: projectId, status: "failed", template }),
      icon: AlertTriangle,
      label: "失败复盘",
      tone: "failed" as const,
      value: `${failed} 个`,
    },
    {
      detail: "完成但缺结果证据，组会和论文前最容易断线。",
      href: experimentHref({ q, project: projectId, status: "completed", template }),
      icon: CheckCircle2,
      label: "缺结果证据",
      tone: "gap" as const,
      value: `${completedWithoutResultCount} 条`,
    },
    {
      detail: "已有结果可以回填正文，或进入成果页补复现状态。",
      href: "/data",
      icon: FileChartColumn,
      label: "已有证据",
      tone: "evidence" as const,
      value: `${experimentsWithEvidenceCount} 条`,
    },
  ];

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
                title="记录一次实验"
                description="先写目的、关键观察和下一步；参数和附件不用现在补全。"
                label="选记录纸开写"
                icon={Plus}
                wide
              >
                <ExperimentForm
                  action={createExperiment}
                  projects={projects}
                  papers={papers}
                />
              </CreateDialog>
              {experimentStack.length ? (
                <form action={createExperimentCloseoutNote}>
                  {experimentStack.map((experiment) => (
                    <input key={experiment.id} type="hidden" name="ids" value={experiment.id} />
                  ))}
                  <SubmitButton variant="outline">
                    <ClipboardList className="size-4" />
                    生成三项收口
                  </SubmitButton>
                </form>
              ) : null}
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
                      experiment={experiment}
                      index={`0${index + 1}`}
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
              从全库自动挑 3 条最该收口的实验，不受当前筛选影响。
            </p>
          </div>
        </div>
      </section>

      {experimentStack.length ? (
        <section className="grid gap-3 rounded-2xl border border-border/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(240,247,247,0.78))] p-3 shadow-[0_10px_24px_rgba(27,42,56,0.032)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold hero-title">
                <TimerReset className="size-4 text-primary" />
                三项实验收口
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                先处理失败、久未更新或缺结果证据的实验。目标不是补全所有字段，而是留下能复盘的下一步。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-fit rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                全库待收口 {totalCloseoutCount} 条
              </span>
              <form action={createExperimentCloseoutNote}>
                {experimentStack.map((experiment) => (
                  <input key={experiment.id} type="hidden" name="ids" value={experiment.id} />
                ))}
                <Button type="submit" variant="outline" size="sm" className="bg-white/82">
                  <ClipboardList className="size-3.5" />
                  生成收口清单
                </Button>
              </form>
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-3">
            {experimentStack.map((experiment, index) => (
              <ExperimentCloseoutCard
                key={experiment.id}
                experiment={experiment}
                index={index + 1}
                now={now}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ExperimentReproBoard
        experimentStack={experimentStack}
        signals={reproducibilitySignals}
        totalCloseoutCount={totalCloseoutCount}
        unresolvedExperimentCount={unresolvedExperimentCount}
      />

      <section className="grid gap-4 xl:grid-cols-[0.28fr_0.72fr]">
        <aside className="grid content-start gap-4">
          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Beaker className="size-4 text-primary" />
                记录纸入口
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {EXPERIMENT_TEMPLATES.map((template) => (
                <TemplateHint
                  key={template.value}
                  value={template.value}
                  title={template.label}
                  detail={template.detail}
                  projects={projects}
                  papers={papers}
                />
              ))}
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" />
                实验收口三步
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <ExperimentFlowStep index="01" title="写观察" detail="先写最新现象、失败原因或关键变化。" />
              <ExperimentFlowStep index="02" title="判结果" detail="有指标、图表或结论时生成结果证据。" />
              <ExperimentFlowStep index="03" title="回填正文" detail="把证据结论写回实验记录，避免上下文断开。" />
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <TimerReset className="size-4 text-primary" />
                今日实验收口
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <ExperimentCloseout
                icon={FlaskConical}
                label="继续观察"
                value={`${running} 个`}
                detail="补目的、观察、结论或下一步"
                href={experimentHref({ q, project: projectId, status: "running", template })}
              />
              <ExperimentCloseout
                icon={AlertTriangle}
                label="失败复盘"
                value={`${failed} 个`}
                detail="先拆原因、对照和下一次修改"
                href={experimentHref({ q, project: projectId, status: "failed", template })}
                tone="warm"
              />
              <ExperimentCloseout
                icon={CheckCircle2}
                label="结果回填"
                value={`${completed} 个完成`}
                detail="完成后要补关键结果或复盘笔记"
                href={experimentHref({ q, project: projectId, status: "completed", template })}
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
            <CardContent className="grid gap-2">
              <QuickStatusLink label="全部实验" count={experiments.length} statusValue="" currentStatus={status} q={q} projectId={projectId} template={template} />
              <QuickStatusLink label="继续观察" count={running} statusValue="running" currentStatus={status} q={q} projectId={projectId} template={template} />
              <QuickStatusLink label="已完成" count={completed} statusValue="completed" currentStatus={status} q={q} projectId={projectId} template={template} />
              <QuickStatusLink label="失败复盘" count={failed} statusValue="failed" currentStatus={status} q={q} projectId={projectId} template={template} />
            </CardContent>
          </Card>
        </aside>

        <div className="grid gap-3">
          <CaptureNotice kind={captured} />

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

function TemplateHint({
  value,
  title,
  detail,
  projects,
  papers,
}: {
  value: string;
  title: string;
  detail: string;
  projects: Project[];
  papers: Paper[];
}) {
  return (
    <div className="rounded-xl border border-[#d5e4e8] bg-[#fffef9]/82 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] transition hover:border-primary/25 hover:bg-white">
      <div className="grid gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#d8e2d6] bg-[#eef4eb] text-primary">
              <FileText className="size-3.5" />
            </span>
            <p className="font-medium text-[var(--workspace-title)]">{title}</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
        <CreateDialog
          title={`用「${title}」记录一次实验`}
          description="已预选记录纸结构。只补标题、项目和正文里真正有用的观察。"
          label="用这张记录纸"
          icon={Plus}
          wide
        >
          <ExperimentForm
            action={createExperiment}
            defaultTemplate={value}
            projects={projects}
            papers={papers}
          />
        </CreateDialog>
      </div>
    </div>
  );
}

function ExperimentReproBoard({
  experimentStack,
  signals,
  totalCloseoutCount,
  unresolvedExperimentCount,
}: {
  experimentStack: ExperimentFull[];
  signals: Array<{
    detail: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    tone: "evidence" | "failed" | "gap" | "running";
    value: string;
  }>;
  totalCloseoutCount: number;
  unresolvedExperimentCount: number;
}) {
  return (
    <section className="experiment-repro overflow-hidden rounded-3xl border border-border/60 p-4 shadow-[0_18px_42px_rgba(27,42,56,0.052)]">
      <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr] xl:items-stretch">
        <div className="experiment-repro-lead rounded-2xl border border-white/70 p-4">
          <span className="research-eyebrow">
            <RotateCcw className="size-3.5" />
            复现与收口板
          </span>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight hero-title">
            实验不是写完就算完，要能复盘、复现、回填证据。
          </h2>
          <p className="mt-3 text-sm leading-6 hero-copy">
            参考 ELN 的模板、状态和正文思路，但这里只保留个人研究最常用的四个判断：
            还在观察、失败复盘、缺结果证据、已有证据。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">待收口实验</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{totalCloseoutCount}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">当前筛选未闭环</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{unresolvedExperimentCount}</p>
            </div>
          </div>
          {experimentStack.length ? (
            <form action={createExperimentCloseoutNote} className="mt-4">
              {experimentStack.map((experiment) => (
                <input key={experiment.id} type="hidden" name="ids" value={experiment.id} />
              ))}
              <SubmitButton className="w-full">
                <ClipboardList className="size-4" />
                收成三项实验清单
              </SubmitButton>
            </form>
          ) : (
            <p className="mt-4 rounded-xl border border-white/68 bg-white/58 px-3 py-2 text-xs leading-5 text-muted-foreground">
              暂时没有明显待收口实验。继续记录新实验，或把已有结果回填到实验正文。
            </p>
          )}
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {signals.map((signal) => (
              <ExperimentReproSignal key={signal.label} {...signal} />
            ))}
          </div>

          <div className="grid gap-2 rounded-2xl border border-white/72 bg-white/60 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] lg:grid-cols-3">
            {experimentStack.length ? (
              experimentStack.map((experiment, index) => {
                const action = experimentNextAction(experiment);
                const Icon = action.icon;

                return (
                  <div key={experiment.id} className="rounded-xl border border-white/74 bg-white/66 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-primary">
                        0{index + 1}
                      </span>
                      <span className="rounded-full border border-[#d5e4e8] bg-[#eef6f4] px-2 py-0.5 text-[11px] text-primary">
                        {action.label}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold hero-title">{experiment.title}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {experiment.project?.title ?? "未关联项目"} · 结果 {experiment.results.length} 条
                    </p>
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#d5e4e8] bg-[#f5fafb] px-2.5 py-2">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/72 text-primary">
                        <Icon className="size-3.5" />
                      </span>
                      <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">{action.detail}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-[#d5e4e8] bg-white/58 p-4 text-sm text-muted-foreground lg:col-span-3">
                没有待收口队列。下一次实验记录只需要先写目的、观察、结论和下一步。
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ExperimentReproSignal({
  detail,
  href,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "evidence" | "failed" | "gap" | "running";
  value: string;
}) {
  const toneClass = {
    evidence: "border-[#d5e8d6] bg-[#eef8ed] text-[#3f6c4d]",
    failed: "border-[#ead9ad] bg-[#fff8e7] text-[#765a23]",
    gap: "border-[#d3e2ee] bg-[#eef6fb] text-[#365a7d]",
    running: "border-[#d5e4e8] bg-[#eef6f4] text-primary",
  }[tone];

  return (
    <Link href={href} className="experiment-repro-card group">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-sm font-semibold hero-title">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </Link>
  );
}

function ExperimentCloseout({
  icon: Icon,
  label,
  value,
  detail,
  href,
  tone = "blue",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  href: string;
  tone?: "blue" | "warm";
}) {
  return (
    <Link
      href={href}
      className="group grid gap-3 rounded-xl border border-border/70 bg-white/72 p-3 transition hover:border-primary/25 hover:bg-white sm:grid-cols-[auto_1fr_auto] sm:items-center xl:grid-cols-[auto_1fr]"
    >
      <span
        className={
          tone === "warm"
            ? "flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#edd8a5] bg-[#fff7df] text-[#7a5a2f]"
            : "flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#d5e4e8] bg-[#eef6f7] text-primary"
        }
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs font-medium text-primary">{value}</span>
        </span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
          {detail}
        </span>
      </span>
    </Link>
  );
}

function ExperimentStackItem({
  index,
  experiment,
  title,
  detail,
}: {
  index: string;
  experiment?: ExperimentFull;
  title?: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-white/50">{index}</span>
        <span className="h-px flex-1 bg-white/12" />
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-white">
        {experiment?.title ?? title}
      </p>
      <p className="mt-1 line-clamp-1 text-xs text-white/58">
        {experiment
          ? `${statusLabel(experiment.status)} · ${experiment.project?.title ?? "未关联项目"} · 结果 ${experiment.results.length} 条`
          : detail}
      </p>
    </div>
  );
}

function prioritizeExperimentCloseout(experiments: ExperimentFull[]) {
  return [...experiments].sort((left, right) => {
    const statusRank = experimentCloseoutRank(left) - experimentCloseoutRank(right);
    if (statusRank !== 0) return statusRank;

    const resultRank = left.results.length - right.results.length;
    if (resultRank !== 0) return resultRank;

    return left.updatedAt.getTime() - right.updatedAt.getTime();
  });
}

function experimentCloseoutRank(experiment: ExperimentFull) {
  if (experiment.status === "failed") return 0;
  if (experiment.status === "running" && experiment.results.length === 0) return 1;
  if (experiment.status === "running") return 2;
  if (experiment.status === "completed" && experiment.results.length === 0) return 3;
  return 4;
}

function ExperimentCloseoutCard({
  experiment,
  index,
  now,
}: {
  experiment: ExperimentFull;
  index: number;
  now: Date;
}) {
  const nextAction = experimentNextAction(experiment);
  const Icon = nextAction.icon;
  const staleDays = Math.max(
    0,
    Math.floor((now.getTime() - experiment.updatedAt.getTime()) / 86_400_000),
  );

  return (
    <Card className="border-border/72 bg-white/86 shadow-[0_8px_22px_rgba(27,42,56,0.038)]">
      <CardContent className="grid h-full gap-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-xs font-semibold text-primary">0{index}</span>
          <span
            className={
              experiment.status === "failed"
                ? "rounded-full border border-[#edd8a5] bg-[#fff7df] px-2 py-0.5 text-[11px] font-medium text-[#7a5a2f]"
                : "rounded-full border border-[#c9e0ea] bg-[#eef6f7] px-2 py-0.5 text-[11px] font-medium text-primary"
            }
          >
            {statusLabel(experiment.status)}
          </span>
        </div>

        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-6">{experiment.title}</p>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {experiment.project?.title ?? "未关联项目"} · {staleDays ? `${staleDays} 天未更新` : "今天更新"}
          </p>
        </div>

        <div className="rounded-xl border border-[#d5e4e8] bg-[#f5fafb] px-3 py-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#d5e4e8] bg-white/72 text-primary">
              <Icon className="size-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium">{nextAction.label}</span>
              <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                {nextAction.detail}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          {experiment.status === "failed" ? (
            <form action={createExperimentReviewTask}>
              <input type="hidden" name="id" value={experiment.id} />
              <Button type="submit" variant="outline" size="sm">
                <ClipboardList className="size-3.5" />
                复盘任务
              </Button>
            </form>
          ) : null}
          {!experiment.results.length ? (
            <form action={createResultFromExperiment}>
              <input type="hidden" name="id" value={experiment.id} />
              <Button type="submit" variant="outline" size="sm">
                <FileChartColumn className="size-3.5" />
                结果证据
              </Button>
            </form>
          ) : null}
          <form action={createExperimentReviewNote}>
            <input type="hidden" name="id" value={experiment.id} />
            <Button type="submit" variant={experiment.status === "failed" ? "default" : "outline"} size="sm">
              <FileText className="size-3.5" />
              复盘笔记
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
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

function experimentHref(values: {
  q?: string;
  project?: string;
  status?: string;
  template?: string;
}) {
  const query = experimentFilterQuery(values);
  return query ? `/experiments?${query}` : "/experiments";
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

function experimentNextAction(experiment: ExperimentFull) {
  if (experiment.status === "failed") {
    return {
      label: "复盘失败",
      title: "先把失败变成下一次实验动作",
      detail: "补失败现象、可能原因、对照组和下一次修改，不让负结果散掉。",
      icon: AlertTriangle,
      className:
        "grid gap-3 rounded-xl border border-amber-200 bg-[#fff8eb] p-3 text-amber-950 sm:grid-cols-[auto_1fr] sm:items-center",
    };
  }

  if (experiment.results.length > 0) {
    return {
      label: "回填结果",
      title: "已有结果，建议回填到实验正文",
      detail: "把关键指标和一句话结论写回实验记录，后续组会和论文素材会更顺。",
      icon: FileChartColumn,
      className:
        "grid gap-3 rounded-xl border border-[#cfe3e5] bg-[#eef7f6] p-3 text-[#285d56] sm:grid-cols-[auto_1fr] sm:items-center",
    };
  }

  if (experiment.status === "completed") {
    return {
      label: "补结果",
      title: "实验已完成，下一步是登记关键结果",
      detail: "至少留下 1-3 个指标、复现状态和图表路径，避免结论只停在正文里。",
      icon: CheckCircle2,
      className:
        "grid gap-3 rounded-xl border border-[#d5e4e8] bg-[#eef6f7] p-3 text-[#315266] sm:grid-cols-[auto_1fr] sm:items-center",
    };
  }

  return {
    label: "继续观察",
    title: "继续补观察、结论和下一步",
    detail: "实验还在进行中，今天先把最新现象写清楚，再决定是否收口。",
    icon: FlaskConical,
    className:
      "grid gap-3 rounded-xl border border-[#d5e4e8] bg-white/74 p-3 text-[#315266] sm:grid-cols-[auto_1fr] sm:items-center",
  };
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
  const nextAction = experimentNextAction(experiment);
  const NextActionIcon = nextAction.icon;

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
                {nextAction.label}
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

        <div className={nextAction.className}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-current shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
            <NextActionIcon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{nextAction.title}</span>
            <span className="mt-1 block text-xs leading-5 opacity-78">{nextAction.detail}</span>
          </span>
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
    <div className="flex gap-3 rounded-xl border border-border/72 bg-[#fffef9]/86 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#d8e2d6] bg-[#eef4eb] text-primary">
        <FileChartColumn className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--workspace-title)]">证据回流</p>
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
            <form action={createResultFromExperiment} className="pt-1">
              <input type="hidden" name="id" value={experiment.id} />
              <Button type="submit" variant="outline" size="sm">
                再记一条证据
              </Button>
            </form>
          </div>
        ) : (
          <div className="mt-2 grid gap-2">
            <p className="text-sm text-muted-foreground">
              暂无证据。实验完成或出现关键观察后，先收一条结果证据草稿。
            </p>
            <form action={createResultFromExperiment}>
              <input type="hidden" name="id" value={experiment.id} />
              <Button type="submit" variant="outline" size="sm">
                <FileChartColumn className="size-3.5" />
                收一条证据
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function ExperimentFlowStep({
  detail,
  index,
  title,
}: {
  detail: string;
  index: string;
  title: string;
}) {
  return (
    <div className="flex gap-2 rounded-xl border border-border/62 bg-[#fffef9]/72 p-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#d8e2d6] bg-[#eef4eb] font-mono text-[11px] font-semibold text-primary">
        {index}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--workspace-title)]">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{detail}</span>
      </span>
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
