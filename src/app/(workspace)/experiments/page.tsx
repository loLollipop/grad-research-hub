import Link from "next/link";
import {
  ClipboardList,
  Beaker,
  Bug,
  CheckCircle2,
  Edit3,
  FileChartColumn,
  FlaskConical,
  Link2,
  Microscope,
  Plus,
  Trash2,
} from "lucide-react";
import type { Experiment, Paper, Project } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  createExperiment,
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

export const dynamic = "force-dynamic";

type ExperimentFull = Experiment & {
  project: Project | null;
  papers: Paper[];
  results: { id: string; title: string; updatedAt: Date }[];
};

export default async function ExperimentsPage() {
  const [experiments, projects, papers] = await Promise.all([
    prisma.experiment.findMany({
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
  const linkedResults = experiments.reduce((sum, experiment) => sum + experiment.results.length, 0);

  return (
    <div className="grid gap-5">
      <section className="dashboard-hero overflow-hidden rounded-2xl border border-border/70 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.08)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_0.86fr] xl:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/65 bg-white/72 px-2.5 py-1 text-xs font-medium text-[#315266]">
                <Microscope className="size-3.5" />
                实验日志
              </span>
              <span className="rounded-full border border-white/55 bg-white/54 px-2.5 py-1 text-xs text-muted-foreground">
                目的 · 观察 · 结论 · 下一步
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-[2rem] font-semibold leading-tight tracking-tight text-[#173042] md:text-[2.5rem]">
              每次实验只留下能复盘的东西。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#557083]">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <SignalCard icon={FlaskConical} label="进行中" value={`${running} 个`} detail="需要继续观察" />
            <SignalCard icon={CheckCircle2} label="已完成" value={`${completed} 个`} detail="可用于复盘" />
            <SignalCard icon={Bug} label="失败案例" value={`${failed} 个`} detail="别浪费负结果" />
            <SignalCard icon={FileChartColumn} label="已登记结果" value={`${linkedResults} 条`} detail="形成证据链" />
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
        </aside>

        <div className="grid gap-3">
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
              title="暂无实验记录"
              description="先建立第一条实验记录，把目的、方法、观察和结论写下来。"
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

function TemplateHint({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3">
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
            </div>
            <h2 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">
              {experiment.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {experiment.project?.title ?? "未关联项目"} · 更新 {formatDateTime(experiment.updatedAt)}
            </p>
          </div>
          <form action={setExperimentStatus} className="flex gap-2">
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

        <div className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-4 text-sm leading-6">
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
          <InfoBlock
            icon={FileChartColumn}
            label="结果记录"
            value={
              experiment.results.length
                ? `${experiment.results.length} 条：${experiment.results[0]?.title}`
                : "暂无"
            }
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border/65 pt-3 md:flex-row md:items-center md:justify-between">
          <TagList value={experiment.tags} />
          <div className="flex flex-wrap items-center gap-2">
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
