import {
  BarChart3,
  CheckCircle2,
  Database,
  FileChartColumn,
  FlaskConical,
  Layers3,
  Link2,
  Plus,
  RotateCcw,
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
import { PageHeader } from "@/components/shared/page-header";
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
  const manuscriptReadyCount = results.filter(
    (result) => parseResultConfig(result.config).manuscriptReady,
  ).length;
  const activeExperiments = experiments.filter((experiment) => experiment.status === "running");
  const manuscriptResults = results.filter(
    (result) => result.artifactPath || parseResultConfig(result.config).manuscriptReady,
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="成果"
        title="成果与复现"
        description="把一次实验真正留下来的东西收拢起来：关键指标、图表位置、复现状态和下一步。数据集只作为辅助信息，不再占据主要流程。"
        actions={
          <div className="flex flex-wrap gap-2">
            <QuickCreate label="记录一次结果" icon={Plus}>
              <ResultForm
                action={createResult}
                datasets={datasets}
                experiments={experiments}
              />
            </QuickCreate>
            <QuickCreate label="补充数据集" icon={Database}>
              <DatasetForm action={createDataset} />
            </QuickCreate>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        <InsightCard
          icon={FileChartColumn}
          label="关键结果"
          value={`${results.length} 条`}
          hint="可用于复盘、周报或论文素材"
        />
        <InsightCard
          icon={CheckCircle2}
          label="已复现"
          value={`${verifiedCount} 条`}
          hint="结果能被再次跑通才算稳"
        />
        <InsightCard
          icon={Layers3}
          label="论文素材"
          value={`${manuscriptReadyCount} 条`}
          hint="图表、表格或结论已可引用"
        />
        <InsightCard
          icon={FlaskConical}
          label="进行中实验"
          value={`${activeExperiments.length} 个`}
          hint="优先补齐这些实验的结果"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-[#1f3d33]" />
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
                description="记录结果时填入一两个核心指标，例如准确率、F1、误差或产率，这里会自动画出最近一次结果。"
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg bg-[#fffdf7]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="size-4 text-[#1f3d33]" />
              今天建议看这里
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-6">
            <WorkflowTip
              title="先确认关键结果"
              text="只记录能支持结论的指标，不把训练日志、脚本参数都搬进来。"
            />
            <WorkflowTip
              title="再确认能否复现"
              text="复现状态用一个下拉选项标记，详细过程仍写在实验记录里。"
            />
            <WorkflowTip
              title="最后沉淀论文素材"
              text="把图、表、截图或结果文件路径写到成果里，周报和论文时能直接找回。"
            />
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="results" className="grid gap-3">
        <TabsList>
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
  );
}

function QuickCreate({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <CreateDialog title={label} label={label} icon={Icon} wide>
      {children}
    </CreateDialog>
  );
}

function InsightCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="rounded-lg bg-white/95">
      <CardContent className="flex gap-3 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eef4ef] text-[#1f3d33]">
          <Icon className="size-4" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowTip({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border bg-white/70 p-3">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted-foreground">{text}</p>
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
    <Card className="rounded-lg bg-white/95">
      <CardContent className="grid gap-3 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{result.title}</h2>
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
            <p className="mt-1 text-sm text-muted-foreground">
              {result.experiment?.title ?? "未关联实验"} ·{" "}
              {result.dataset?.name ?? "未关联数据集"} · 更新 {formatDateTime(result.updatedAt)}
            </p>
          </div>
          <MetricPills metrics={metrics} />
        </div>

        {result.notes ? (
          <p className="rounded-lg border bg-[#fffdf7] p-3 text-sm leading-6 text-muted-foreground">
            {result.notes}
          </p>
        ) : null}

        {result.artifactPath ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link2 className="size-4" />
            图表/结果文件：{result.artifactPath}
          </p>
        ) : null}

        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">编辑结果</summary>
          <div className="mt-3">
            <ResultForm
              action={updateResult}
              result={result}
              datasets={datasets}
              experiments={experiments}
            />
            <form action={deleteResult} className="mt-3">
              <input type="hidden" name="id" value={result.id} />
              <Button type="submit" variant="destructive">
                <Trash2 className="size-4" />
                删除结果
              </Button>
            </form>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function ManuscriptCard({ result }: { result: ResultFull }) {
  const config = parseResultConfig(result.config);
  const metrics = parseJson<Record<string, number | string>>(result.metrics, {});

  return (
    <Card className="rounded-lg bg-white/95">
      <CardContent className="grid gap-3 py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{result.title}</h2>
              <ReproducibilityBadge result={result} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {config.manuscriptReady ? "已标记为论文素材" : "有图表或结果文件路径"} ·{" "}
              {formatDateTime(result.updatedAt)}
            </p>
          </div>
          <MetricPills metrics={metrics} />
        </div>
        {result.artifactPath ? (
          <p className="flex items-center gap-2 rounded-lg border bg-[#fffdf7] p-3 text-sm text-muted-foreground">
            <Link2 className="size-4 shrink-0" />
            {result.artifactPath}
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
    <Card className="rounded-lg bg-white/95">
      <CardContent className="grid gap-3 py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-semibold">{dataset.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {dataset.source ?? "来源未填"} · {dataset.version ?? "无版本"} ·{" "}
              {dataset.path ?? "无路径"}
            </p>
            {dataset.externalUrl ? (
              <a
                className="mt-1 inline-flex text-xs text-[#1f3d33] underline-offset-4 hover:underline"
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
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">编辑数据集</summary>
          <div className="mt-3">
            <DatasetForm action={updateDataset} dataset={dataset} />
            <form action={deleteDataset} className="mt-3">
              <input type="hidden" name="id" value={dataset.id} />
              <Button type="submit" variant="destructive">
                <Trash2 className="size-4" />
                删除数据集
              </Button>
            </form>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function MetricPills({ metrics }: { metrics: Record<string, number | string> }) {
  const entries = Object.entries(metrics).filter(([, value]) => String(value).trim());

  if (!entries.length) {
    return (
      <span className="rounded-md border bg-stone-50 px-2 py-1 text-xs text-muted-foreground">
        未填写指标
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {entries.slice(0, 6).map(([key, value]) => (
        <span key={key} className="rounded-md border bg-[#fffdf7] px-2 py-1">
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
      <label className="flex items-center gap-2 rounded-lg border bg-[#fffdf7] px-3 py-2 text-sm">
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
      <input
        type="hidden"
        name="metrics"
        value={result?.metrics ?? "{}"}
      />
      <input
        type="hidden"
        name="config"
        value={result?.config ?? "{}"}
      />
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
