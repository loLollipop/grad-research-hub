import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Database,
  Edit3,
  FileChartColumn,
  FileText,
  Layers3,
  Link2,
  Plus,
  RotateCcw,
  Search,
  Target,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Dataset, Experiment, Prisma, Result } from "@prisma/client";

import { ResultMetricsChart } from "@/components/charts/result-metrics-chart";
import {
  createDataset,
  createResultBriefNote,
  createTaskFromResult,
  createWritingNoteFromResult,
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

type Props = {
  searchParams: Promise<{
    q?: string;
    reproducibility?: string;
    manuscript?: string;
    experiment?: string;
    dataset?: string;
    brief?: string;
  }>;
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

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type DataFilters = {
  q?: string;
  reproducibility?: string;
  manuscript?: string;
  experiment?: string;
  dataset?: string;
};

function dataHref(filters: DataFilters, patch: Partial<DataFilters>) {
  const merged = { ...filters, ...patch };
  const query = new URLSearchParams();

  if (merged.q) query.set("q", merged.q);
  if (merged.reproducibility) query.set("reproducibility", merged.reproducibility);
  if (merged.manuscript) query.set("manuscript", merged.manuscript);
  if (merged.experiment) query.set("experiment", merged.experiment);
  if (merged.dataset) query.set("dataset", merged.dataset);

  return query.size ? `/data?${query.toString()}` : "/data";
}

export default async function DataPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = valueOf(params.q)?.trim();
  const reproducibility = valueOf(params.reproducibility);
  const manuscript = valueOf(params.manuscript);
  const experimentId = valueOf(params.experiment);
  const datasetId = valueOf(params.dataset);
  const brief = valueOf(params.brief);
  const activeFilterCount = [q, reproducibility, manuscript, experimentId, datasetId].filter(Boolean).length;
  const currentFilters: DataFilters = {
    q,
    reproducibility,
    manuscript,
    experiment: experimentId,
    dataset: datasetId,
  };

  const resultFilters: Prisma.ResultWhereInput[] = [];
  if (q) {
    resultFilters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { metrics: { contains: q, mode: "insensitive" } },
        { artifactPath: { contains: q, mode: "insensitive" } },
        { experiment: { title: { contains: q, mode: "insensitive" } } },
        { dataset: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (experimentId) {
    resultFilters.push({ experimentId });
  }
  if (datasetId) {
    resultFilters.push({ datasetId });
  }
  const resultWhere: Prisma.ResultWhereInput = resultFilters.length ? { AND: resultFilters } : {};

  const [datasets, experiments, results] = await Promise.all([
    prisma.dataset.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.experiment.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.result.findMany({
      where: resultWhere,
      orderBy: { updatedAt: "desc" },
      include: { experiment: true, dataset: true },
    }),
  ]);

  const filteredResults = results.filter((result) => {
    const config = parseResultConfig(result.config);
    if (reproducibility && config.reproducibility !== reproducibility) return false;
    if (manuscript === "ready" && !config.manuscriptReady && !result.artifactPath) return false;
    if (manuscript === "not-ready" && (config.manuscriptReady || result.artifactPath)) return false;
    return true;
  });
  const latestResult = filteredResults[0];
  const chartData = latestResult ? metricsFromJson(latestResult.metrics) : [];
  const verifiedCount = filteredResults.filter(
    (result) => parseResultConfig(result.config).reproducibility === "verified",
  ).length;
  const reproducingCount = filteredResults.filter(
    (result) => parseResultConfig(result.config).reproducibility === "reproducing",
  ).length;
  const manuscriptReadyCount = filteredResults.filter(
    (result) => parseResultConfig(result.config).manuscriptReady,
  ).length;
  const manuscriptResults = filteredResults.filter(
    (result) => result.artifactPath || parseResultConfig(result.config).manuscriptReady,
  );
  const evidenceQueue = filteredResults
    .filter(needsEvidenceTask)
    .sort((left, right) => resultEvidenceRank(left) - resultEvidenceRank(right))
    .slice(0, 5);
  const evidenceStack = [...filteredResults]
    .sort((left, right) => resultEvidenceRank(left) - resultEvidenceRank(right))
    .slice(0, 3);
  const quickBaseResults = results;
  const unknownCount = quickBaseResults.filter(
    (result) => (parseResultConfig(result.config).reproducibility ?? "unknown") === "unknown",
  ).length;
  const todoCount = quickBaseResults.filter(
    (result) => parseResultConfig(result.config).reproducibility === "todo",
  ).length;
  const reproducingBaseCount = quickBaseResults.filter(
    (result) => parseResultConfig(result.config).reproducibility === "reproducing",
  ).length;
  const verifiedBaseCount = quickBaseResults.filter(
    (result) => parseResultConfig(result.config).reproducibility === "verified",
  ).length;
  const manuscriptBaseCount = quickBaseResults.filter(
    (result) => parseResultConfig(result.config).manuscriptReady || result.artifactPath,
  ).length;
  const selectedExperimentTitle = experiments.find((experiment) => experiment.id === experimentId)?.title;
  const selectedDatasetName = datasets.find((dataset) => dataset.id === datasetId)?.name;

  return (
    <div className="grid gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/76 px-2.5 py-1 text-xs font-medium text-[#274563]">
                <FileChartColumn className="size-3.5" />
                结果证据台
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                指标 · 复现 · 论文素材
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              成果页只回答一件事：这条结果能不能支撑结论。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              不把这里做成数据仓库，只保留关键指标、复现状态、图表路径和一句话结论。
              结果先变成可信证据，再进入周报、组会和论文素材。
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
              <form action={createResultBriefNote} className="contents">
                {filteredResults.slice(0, 12).map((result) => (
                  <input key={result.id} type="hidden" name="ids" value={result.id} />
                ))}
                <Button type="submit" variant="outline" disabled={!filteredResults.length}>
                  <ClipboardList className="size-4" />
                  生成汇报清单
                </Button>
              </form>
            </div>
            {brief === "empty" ? (
              <p className="mt-3 max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                当前没有可生成的结果。先记录一条关键结果，或清除筛选后再试。
              </p>
            ) : null}
          </div>

          <div className="flex min-h-64 flex-col justify-between rounded-2xl action-stack p-4 text-white shadow-[0_18px_36px_rgba(22,34,53,0.16)]">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-white/68">
                <Layers3 className="size-3.5" />
                今日证据栈
              </p>
              <div className="mt-4 grid gap-2.5">
                {evidenceStack.length ? (
                  evidenceStack.map((result, index) => (
                    <ResultStackItem
                      key={result.id}
                      index={`0${index + 1}`}
                      title={result.title}
                      detail={`${resultActionLabel(result)} · ${result.experiment?.title ?? "未关联实验"}`}
                    />
                  ))
                ) : (
                  <ResultStackItem
                    index="01"
                    title="先记录一条能讲清楚的结果"
                    detail="核心指标、复现状态、图表路径"
                  />
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
              <div>
                <p className="text-lg font-semibold tracking-tight">{verifiedCount}</p>
                <p className="mt-0.5 text-[11px] text-white/54">已复现</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{reproducingCount}</p>
                <p className="mt-0.5 text-[11px] text-white/54">复现中</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{manuscriptReadyCount}</p>
                <p className="mt-0.5 text-[11px] text-white/54">可写入</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.35fr_0.65fr]">
        <aside className="grid content-start gap-4">
          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="size-4 text-primary" />
                下一步证据
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
                          {resultActionLabel(result)} · {result.experiment?.title ?? "未关联实验"}
                        </p>
                      </div>
                      <ReproducibilityBadge result={result} />
                    </div>
                    <div className="mt-3">
                      <CreateTaskFromResultButton result={result} compact />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">没有待补证据的结果。</p>
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
              <QuickDataLink
                label="全部结果"
                count={quickBaseResults.length}
                href={dataHref(currentFilters, { reproducibility: undefined, manuscript: undefined })}
                active={!reproducibility && !manuscript}
              />
              <QuickDataLink
                label="待判断"
                count={unknownCount}
                href={dataHref(currentFilters, { reproducibility: "unknown", manuscript: undefined })}
                active={reproducibility === "unknown" && !manuscript}
              />
              <QuickDataLink
                label="待复现"
                count={todoCount}
                href={dataHref(currentFilters, { reproducibility: "todo", manuscript: undefined })}
                active={reproducibility === "todo" && !manuscript}
              />
              <QuickDataLink
                label="复现中"
                count={reproducingBaseCount}
                href={dataHref(currentFilters, { reproducibility: "reproducing", manuscript: undefined })}
                active={reproducibility === "reproducing" && !manuscript}
              />
              <QuickDataLink
                label="已复现"
                count={verifiedBaseCount}
                href={dataHref(currentFilters, { reproducibility: "verified", manuscript: undefined })}
                active={reproducibility === "verified" && !manuscript}
              />
              <QuickDataLink
                label="可写入"
                count={manuscriptBaseCount}
                href={dataHref(currentFilters, { reproducibility: undefined, manuscript: "ready" })}
                active={manuscript === "ready" && !reproducibility}
              />
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
          <form className="grid gap-2 rounded-2xl border border-border/72 bg-white/88 p-3 shadow-[0_12px_28px_rgba(27,42,56,0.045)] xl:grid-cols-[1fr_145px_150px_170px_170px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" placeholder="搜索结果、指标、结论、文件路径" defaultValue={q} className="pl-8" />
            </div>
            <select
              name="reproducibility"
              defaultValue={reproducibility ?? ""}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部复现</option>
              {reproducibilityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              name="manuscript"
              defaultValue={manuscript ?? ""}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部素材</option>
              <option value="ready">可写入论文</option>
              <option value="not-ready">待补素材</option>
            </select>
            <select
              name="experiment"
              defaultValue={experimentId ?? ""}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部实验</option>
              {experiments.map((experiment) => (
                <option key={experiment.id} value={experiment.id}>
                  {experiment.title}
                </option>
              ))}
            </select>
            <select
              name="dataset"
              defaultValue={datasetId ?? ""}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部数据集</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              筛选
            </Button>
          </form>

          <div className="flex flex-col gap-2 rounded-2xl border border-border/72 bg-white/78 p-3 text-sm shadow-[0_10px_24px_rgba(34,48,71,0.04)] md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">当前结果 {filteredResults.length} 条</span>
              {reproducibility ? (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  {reproducibilityLabel(reproducibility)}
                </span>
              ) : null}
              {manuscript ? (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  {manuscript === "ready" ? "可写入论文" : "待补素材"}
                </span>
              ) : null}
              {selectedExperimentTitle ? (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  {selectedExperimentTitle}
                </span>
              ) : null}
              {selectedDatasetName ? (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  {selectedDatasetName}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filteredResults.length ? (
                <form action={createResultBriefNote} className="contents">
                  {filteredResults.slice(0, 12).map((result) => (
                    <input key={result.id} type="hidden" name="ids" value={result.id} />
                  ))}
                  <Button type="submit" variant="outline" size="sm">
                    <ClipboardList className="size-3.5" />
                    生成当前清单
                  </Button>
                </form>
              ) : null}
              {activeFilterCount ? (
                <Link
                  href="/data"
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
          </div>

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
              {filteredResults.length ? (
                filteredResults.map((result) => (
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
                  title={activeFilterCount ? "没有匹配的关键结果" : "暂无关键结果"}
                  description={
                    activeFilterCount
                      ? "试着清除筛选，或换一个复现状态、实验、数据集再看。"
                      : "从最近一次实验开始，记录结论、核心指标和下一步即可。"
                  }
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

function ResultStackItem({
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

function WorkflowTip({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function QuickDataLink({
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
          : "flex items-center justify-between rounded-xl border border-border/72 bg-[#fbfcfd]/88 px-3 py-2 text-sm transition hover:border-primary/25 hover:bg-white"
      }
    >
      <span>{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </Link>
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
  const nextAction = resultActionLabel(result);

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
              <span className="rounded-md border border-[#d8e5ee] bg-[#eef4fb] px-2 py-0.5 text-xs text-[#365a7d]">
                {nextAction}
              </span>
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
          <CreateWritingNoteFromResultButton result={result} />
          {needsEvidenceTask(result) ? (
            <CreateTaskFromResultButton result={result} />
          ) : null}
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

function CreateWritingNoteFromResultButton({ result }: { result: ResultFull }) {
  return (
    <form action={createWritingNoteFromResult}>
      <input type="hidden" name="id" value={result.id} />
      <Button type="submit" variant="outline" size="sm">
        <FileText className="size-3.5" />
        写作素材
      </Button>
    </form>
  );
}

function CreateTaskFromResultButton({
  result,
  compact = false,
}: {
  result: ResultFull;
  compact?: boolean;
}) {
  return (
    <form action={createTaskFromResult}>
      <input type="hidden" name="id" value={result.id} />
      <Button type="submit" variant="outline" size="sm">
        <Target className="size-3.5" />
        {compact ? "变任务" : "生成待补任务"}
      </Button>
    </form>
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
        <div className="flex justify-end border-t border-border/65 pt-3">
          <CreateWritingNoteFromResultButton result={result} />
        </div>
      </CardContent>
    </Card>
  );
}

function needsEvidenceTask(result: ResultFull) {
  const config = parseResultConfig(result.config);
  return config.reproducibility !== "verified" || (!config.manuscriptReady && !result.artifactPath);
}

function resultActionLabel(result: ResultFull) {
  const config = parseResultConfig(result.config);
  const reproducibility = config.reproducibility ?? "unknown";

  if (reproducibility === "unknown") {
    return "先判定复现";
  }

  if (reproducibility === "todo") {
    return "补复现实验";
  }

  if (reproducibility === "reproducing") {
    return "继续复现";
  }

  if (!result.artifactPath) {
    return "补图表路径";
  }

  if (!config.manuscriptReady) {
    return "标成写作素材";
  }

  return "已成证据";
}

function resultEvidenceRank(result: ResultFull) {
  const config = parseResultConfig(result.config);
  const reproducibility = config.reproducibility ?? "unknown";
  const reproducibilityRank: Record<string, number> = {
    reproducing: 0,
    todo: 1,
    unknown: 2,
    verified: 3,
  };
  const pathPenalty = result.artifactPath ? 0 : -0.4;
  const readyPenalty = config.manuscriptReady ? 0.5 : 0;

  return (reproducibilityRank[reproducibility] ?? 2) + pathPenalty + readyPenalty;
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
  const label = reproducibilityLabel(value);

  return (
    <Badge
      variant="outline"
      className={`rounded-md ${reproducibilityTone[value] ?? reproducibilityTone.unknown}`}
    >
      {label}
    </Badge>
  );
}

function reproducibilityLabel(value: string) {
  return reproducibilityOptions.find((option) => option.value === value)?.label ?? "待判断";
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
