import {
  BarChart3,
  CheckCircle2,
  Database,
  Edit3,
  FileChartColumn,
  FlaskConical,
  Layers3,
  Link2,
  Plus,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react";
import type { Dataset, Experiment, Result } from "@prisma/client";

import { ResultMetricsChart } from "@/components/charts/result-metrics-chart";
import {
  createDataset,
  createResult,
  deleteDataset,
  deleteResult,
  updateDataset,
  updateResult,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDateTime, metricsFromJson, parseJson, parseTags } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateDialog } from "@/components/shared/create-dialog";
import { Field } from "@/components/shared/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type ResultFull = Result & {
  experiment: Experiment | null;
  dataset: Dataset | null;
};

type ResultConfig = {
  reproducibility?: "unknown" | "todo" | "reproducing" | "verified";
  manuscriptReady?: boolean;
};

const reproducibilityOptions = [
  { value: "unknown", label: "待判断" },
  { value: "todo", label: "待复现" },
  { value: "reproducing", label: "复现中" },
  { value: "verified", label: "已复现" },
] as const;

const reproducibilityTone: Record<string, string> = {
  unknown: "border-stone-200 bg-stone-50 text-stone-700",
  todo: "border-amber-200 bg-amber-50 text-amber-700",
  reproducing: "border-sky-200 bg-sky-50 text-sky-700",
  verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default async function DataPage() {
  const [datasets, experiments, results] = await Promise.all([
    prisma.dataset.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.experiment.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.result.findMany({
      orderBy: { updatedAt: "desc" },
      include: { experiment: true, dataset: true },
    }),
  ]);

  const latestResult = results[0];
  const chartData = latestResult ? metricsFromJson(latestResult.metrics) : [];
  const verifiedCount = results.filter(
    (result) => parseResultConfig(result.config).reproducibility === "verified",
  ).length;
  const reproducingCount = results.filter(
    (result) => parseResultConfig(result.config).reproducibility === "reproducing",
  ).length;
  const manuscriptReadyCount = results.filter(
    (result) => parseResultConfig(result.config).manuscriptReady,
  ).length;
  const activeExperiments = experiments.filter((experiment) => experiment.status === "running");
  const manuscriptResults = results.filter(
    (result) => result.artifactPath || parseResultConfig(result.config).manuscriptReady,
  );
  const evidenceQueue = results
    .filter((result) => parseResultConfig(result.config).reproducibility !== "verified")
    .slice(0, 5);

  return (
    <div className="grid gap-5">
      <section className="dashboard-hero overflow-hidden rounded-2xl border border-border/70 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.08)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr] xl:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/65 bg-white/72 px-2.5 py-1 text-xs font-medium text-[#315266]">
                <FileChartColumn className="size-3.5" />
                结果证据台
              </span>
              <span className="rounded-full border border-white/55 bg-white/54 px-2.5 py-1 text-xs text-muted-foreground">
                指标 · 复现 · 论文素材
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-[2rem] font-semibold leading-tight tracking-tight text-[#173042] md:text-[2.5rem]">
              不保存一堆日志，只留下能支撑结论的证据。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#557083]">
              成果页只关心三件事：核心指标是什么、结果能不能复现、是否已经能写进周报、
              组会或论文。数据集作为辅助，不再抢占主流程。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <CreateDialog
                title="记录关键结果"
                description="只填最关键的 1-3 个指标、复现状态和一句话结论。"
                label="记录结果"
                icon={Plus}
                wide
              >
                <ResultForm
                  action={createResult}
                  datasets={datasets}
                  experiments={experiments}
                />
              </CreateDialog>
              <CreateDialog
                title="补充数据集"
                description="只有当结果需要固定数据来源或版本时，再补这一步。"
                label="补充数据集"
                icon={Database}
              >
                <DatasetForm action={createDataset} />
              </CreateDialog>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SignalCard icon={FileChartColumn} label="关键结果" value={`${results.length} 条`} detail="可复盘证据" />
            <SignalCard icon={CheckCircle2} label="已复现" value={`${verifiedCount} 条`} detail={`${reproducingCount} 条复现中`} />
            <SignalCard icon={Layers3} label="论文素材" value={`${manuscriptReadyCount} 条`} detail="周报和论文可引用" />
            <SignalCard icon={FlaskConical} label="进行中实验" value={`${activeExperiments.length} 个`} detail="优先补结果" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.35fr_0.65fr]">
        <aside className="grid content-start gap-4">
          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Target className="size-4 text-primary" />
                待补证据
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {evidenceQueue.length ? (
                evidenceQueue.map((result) => (
                  <div key={result.id} className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="line-clamp-1 font-medium">{result.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {result.experiment?.title ?? "未关联实验"}
                        </p>
                      </div>
                      <ReproducibilityBadge result={result} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">没有待补复现的结果。</p>
              )}
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="size-4 text-primary" />
                记录原则
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <WorkflowTip title="少填参数" text="参数、脚本和过程放实验日志，这里只保留结论证据。" />
              <WorkflowTip title="先看复现" text="能复现的结果比单次漂亮指标更值得写进论文。" />
              <WorkflowTip title="标出素材" text="图表路径、结果文件和一句话结论，是周报时最省时间的东西。" />
            </CardContent>
          </Card>
        </aside>

        <div className="grid gap-4">
          <Card className="workbench-card overflow-hidden">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" />
                最近一次结果指标
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length ? (
                <div className="grid gap-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="font-semibold">{latestResult?.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {latestResult?.experiment?.title ?? "未关联实验"} · 更新{" "}
                        {formatDateTime(latestResult?.updatedAt)}
                      </p>
                    </div>
                    {latestResult ? <ReproducibilityBadge result={latestResult} /> : null}
                  </div>
                  <ResultMetricsChart data={chartData} />
                </div>
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="暂无可视化指标"
                  description="记录结果时填一两个核心指标，例如准确率、F1、误差或产率，这里会自动画出最近一次结果。"
                />
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="results" className="grid gap-3">
            <TabsList className="w-fit">
              <TabsTrigger value="results">关键结果</TabsTrigger>
              <TabsTrigger value="manuscript">论文素材</TabsTrigger>
              <TabsTrigger value="datasets">数据集</TabsTrigger>
            </TabsList>
            <TabsContent value="results" className="grid gap-3">
              {results.length ? (
                results.map((result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    datasets={datasets}
                    experiments={experiments}
                  />
                ))
              ) : (
                <EmptyState
                  icon={FileChartColumn}
                  title="暂无关键结果"
                  description="从最近一次实验开始，记录结论、核心指标和下一步即可。"
                />
              )}
            </TabsContent>
            <TabsContent value="manuscript" className="grid gap-3">
              {manuscriptResults.length ? (
                manuscriptResults.map((result) => (
                  <ManuscriptCard key={result.id} result={result} />
                ))
              ) : (
                <EmptyState
                  icon={Layers3}
                  title="暂无论文素材"
                  description="把能写进论文、周报或组会的图表路径标出来，这里会自动汇总。"
                />
              )}
            </TabsContent>
            <TabsContent value="datasets" className="grid gap-3">
              {datasets.length ? (
                datasets.map((dataset) => <DatasetCard key={dataset.id} dataset={dataset} />)
              ) : (
                <EmptyState
                  icon={Database}
                  title="暂无数据集"
                  description="只有当结果需要固定数据来源或版本时，再补充数据集信息。"
                />
              )}
            </TabsContent>
          </Tabs>
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

function WorkflowTip({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function ResultCard({
  result,
  datasets,
  experiments,
}: {
  result: ResultFull;
  datasets: Dataset[];
  experiments: Experiment[];
}) {
  const metrics = parseJson<Record<string, number | string>>(result.metrics, {});
  const config = parseResultConfig(result.config);

  return (
    <Card className="workbench-card">
      <CardContent className="grid gap-3 py-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ReproducibilityBadge result={result} />
              {config.manuscriptReady ? (
                <Badge
                  variant="outline"
                  className="rounded-md border-indigo-200 bg-indigo-50 text-indigo-700"
                >
                  可写入论文
                </Badge>
              ) : null}
            </div>
            <h2 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">
              {result.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.experiment?.title ?? "未关联实验"} ·{" "}
              {result.dataset?.name ?? "未关联数据集"} · 更新 {formatDateTime(result.updatedAt)}
            </p>
          </div>
          <MetricPills metrics={metrics} />
        </div>

        {result.notes ? (
          <p className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3 text-sm leading-6 text-muted-foreground">
            {result.notes}
          </p>
        ) : null}

        {result.artifactPath ? (
          <p className="flex items-center gap-2 rounded-xl border border-border/72 bg-white/70 p-3 text-sm text-muted-foreground">
            <Link2 className="size-4 shrink-0" />
            <span className="break-all">{result.artifactPath}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/65 pt-3">
          <CreateDialog title="编辑结果" label="编辑" icon={Edit3} wide>
            <ResultForm
              action={updateResult}
              result={result}
              datasets={datasets}
              experiments={experiments}
            />
          </CreateDialog>
          <form action={deleteResult}>
            <input type="hidden" name="id" value={result.id} />
            <Button type="submit" variant="destructive" size="sm">
              <Trash2 className="size-3.5" />
              删除
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function ManuscriptCard({ result }: { result: ResultFull }) {
  const config = parseResultConfig(result.config);
  const metrics = parseJson<Record<string, number | string>>(result.metrics, {});

  return (
    <Card className="workbench-card">
      <CardContent className="grid gap-3 py-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ReproducibilityBadge result={result} />
              <h2 className="font-semibold">{result.title}</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {config.manuscriptReady ? "已标记为论文素材" : "有图表或结果文件路径"} ·{" "}
              {formatDateTime(result.updatedAt)}
            </p>
          </div>
          <MetricPills metrics={metrics} />
        </div>
        {result.artifactPath ? (
          <p className="flex items-center gap-2 rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3 text-sm text-muted-foreground">
            <Link2 className="size-4 shrink-0" />
            <span className="break-all">{result.artifactPath}</span>
          </p>
        ) : null}
        {result.notes ? (
          <p className="text-sm leading-6 text-muted-foreground">{result.notes}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DatasetCard({ dataset }: { dataset: Dataset }) {
  return (
    <Card className="workbench-card">
      <CardContent className="grid gap-3 py-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <div className="min-w-0">
            <h2 className="font-semibold">{dataset.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {dataset.source ?? "来源未填"} · {dataset.version ?? "无版本"} ·{" "}
              {dataset.path ?? "无路径"}
            </p>
            {dataset.externalUrl ? (
              <a
                className="mt-1 inline-flex text-xs text-primary underline-offset-4 hover:underline"
                href={dataset.externalUrl}
              >
                外部数据页
              </a>
            ) : null}
          </div>
          <TagList value={dataset.tags} />
        </div>
        {dataset.description ? (
          <p className="text-sm leading-6 text-muted-foreground">{dataset.description}</p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border/65 pt-3">
          <CreateDialog title="编辑数据集" label="编辑" icon={Edit3}>
            <DatasetForm action={updateDataset} dataset={dataset} />
          </CreateDialog>
          <form action={deleteDataset}>
            <input type="hidden" name="id" value={dataset.id} />
            <Button type="submit" variant="destructive" size="sm">
              <Trash2 className="size-3.5" />
              删除
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricPills({ metrics }: { metrics: Record<string, number | string> }) {
  const entries = Object.entries(metrics).filter(([, value]) => String(value).trim());

  if (!entries.length) {
    return (
      <span className="rounded-lg border bg-stone-50 px-2.5 py-1 text-xs text-muted-foreground">
        未填写指标
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {entries.slice(0, 6).map(([key, value]) => (
        <span key={key} className="rounded-lg border bg-[#fbfcfd] px-2.5 py-1">
          {key}: {String(value)}
        </span>
      ))}
    </div>
  );
}

function ReproducibilityBadge({ result }: { result: Pick<Result, "config"> }) {
  const config = parseResultConfig(result.config);
  const value = config.reproducibility ?? "unknown";
  const label = reproducibilityOptions.find((option) => option.value === value)?.label ?? "待判断";

  return (
    <Badge
      variant="outline"
      className={`rounded-md ${reproducibilityTone[value] ?? reproducibilityTone.unknown}`}
    >
      {label}
    </Badge>
  );
}

function DatasetForm({
  action,
  dataset,
}: {
  action: (formData: FormData) => Promise<void>;
  dataset?: Dataset;
}) {
  return (
    <form action={action} className="grid gap-3">
      {dataset ? <input type="hidden" name="id" value={dataset.id} /> : null}
      <Field label="数据集名称">
        <Input name="name" required defaultValue={dataset?.name ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="来源">
          <Input name="source" defaultValue={dataset?.source ?? ""} />
        </Field>
        <Field label="版本">
          <Input name="version" defaultValue={dataset?.version ?? ""} />
        </Field>
      </div>
      <Field label="位置或链接">
        <Input name="path" defaultValue={dataset?.path ?? ""} />
      </Field>
      <Field label="外部链接">
        <Input name="externalUrl" defaultValue={dataset?.externalUrl ?? ""} />
      </Field>
      <Field label="标签">
        <Input name="tags" defaultValue={parseTags(dataset?.tags).join(", ")} />
      </Field>
      <Field label="一句话说明">
        <Textarea
          name="description"
          rows={3}
          defaultValue={dataset?.description ?? ""}
          placeholder="例如：最终实验使用的清洗后数据，来自 2026-05 版本。"
        />
      </Field>
      <SubmitButton>{dataset ? "保存数据集" : "保存数据集"}</SubmitButton>
    </form>
  );
}

function ResultForm({
  action,
  datasets,
  experiments,
  result,
}: {
  action: (formData: FormData) => Promise<void>;
  datasets: Dataset[];
  experiments: Experiment[];
  result?: Result;
}) {
  const metrics = parseJson<Record<string, number | string>>(result?.metrics, {});
  const config = parseResultConfig(result?.config);
  const metricRows = normalizeMetricRows(metrics);

  return (
    <form action={action} className="grid gap-3">
      {result ? <input type="hidden" name="id" value={result.id} /> : null}
      <Field label="结果标题">
        <Input
          name="title"
          required
          defaultValue={result?.title ?? ""}
          placeholder="例如：消融实验 - 去掉注意力模块"
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="关联实验">
          <select
            name="experimentId"
            defaultValue={result?.experimentId ?? ""}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">不关联实验</option>
            {experiments.map((experiment) => (
              <option key={experiment.id} value={experiment.id}>
                {experiment.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="数据集">
          <select
            name="datasetId"
            defaultValue={result?.datasetId ?? ""}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">不关联数据集</option>
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="复现状态">
          <select
            name="reproducibility"
            defaultValue={config.reproducibility ?? "unknown"}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            {reproducibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-medium text-muted-foreground">核心指标</p>
        <div className="grid gap-2 md:grid-cols-3">
          {metricRows.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr] gap-2">
              <Input
                name="metricName"
                defaultValue={row.name}
                placeholder={index === 0 ? "指标名，如 F1" : "指标名"}
              />
              <Input
                name="metricValue"
                defaultValue={row.value}
                placeholder={index === 0 ? "数值，如 0.86" : "数值"}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          填 1-3 个最关键的指标即可，别把整份日志搬进来。
        </p>
      </div>

      <Field label="图表或结果文件">
        <Input
          name="artifactPath"
          defaultValue={result?.artifactPath ?? ""}
          placeholder="例如：figures/ablation_attention.png 或服务器结果路径"
        />
      </Field>
      <label className="flex items-center gap-2 rounded-lg border bg-[#fbfcfd] px-3 py-2 text-sm">
        <input
          type="checkbox"
          name="manuscriptReady"
          value="true"
          defaultChecked={Boolean(config.manuscriptReady)}
          className="size-4"
        />
        这条结果已经可以写进周报、组会或论文
      </label>
      <Field label="结论与下一步">
        <Textarea
          name="notes"
          rows={4}
          defaultValue={result?.notes ?? ""}
          placeholder="一句话结论 + 下一步，例如：提升主要来自数据清洗；下一步复现 baseline。"
        />
      </Field>
      <input type="hidden" name="metrics" value={result?.metrics ?? "{}"} />
      <input type="hidden" name="config" value={result?.config ?? "{}"} />
      <SubmitButton>{result ? "保存结果" : "记录结果"}</SubmitButton>
    </form>
  );
}

function normalizeMetricRows(metrics: Record<string, number | string>) {
  const rows = Object.entries(metrics)
    .filter(([name]) => name.trim())
    .slice(0, 3)
    .map(([name, value]) => ({ name, value: String(value) }));

  while (rows.length < 3) {
    rows.push({ name: "", value: "" });
  }

  return rows;
}

function parseResultConfig(value: string | null | undefined): ResultConfig {
  return parseJson<ResultConfig>(value, {});
}
