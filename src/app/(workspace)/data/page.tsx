import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  Edit3,
  FileCheck2,
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
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { Dataset, Experiment, Prisma, Result } from "@prisma/client";

import { ResultMetricsChart } from "@/components/charts/result-metrics-chart";
import { CaptureNotice } from "@/components/shared/capture-notice";
import {
  createDataset,
  createDatasetAuditNote,
  createResultBriefNote,
  createResultCloseoutNote,
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
import { cn } from "@/lib/utils";
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
    captured?: string;
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

type FigureEvidenceSignal = {
  action: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  label: string;
  tone: "evidence" | "figure" | "repro" | "writing";
  value: string;
};

type DatasetHealthSignal = {
  action: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  label: string;
  tone: "link" | "location" | "result" | "version";
  value: string;
};

type DatasetHealthCandidate = {
  dataset: Dataset;
  latestResultAt: Date | null;
  linkedResultCount: number;
  missing: string[];
  score: number;
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
  const captured = valueOf(params.captured);
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

  const [datasets, experiments, results, evidenceCandidates, allResultSources] = await Promise.all([
    prisma.dataset.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.experiment.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.result.findMany({
      where: resultWhere,
      orderBy: { updatedAt: "desc" },
      include: { experiment: true, dataset: true },
    }),
    prisma.result.findMany({
      orderBy: { updatedAt: "desc" },
      include: { experiment: true, dataset: true },
      take: 24,
    }),
    prisma.result.findMany({
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
  const prioritizedEvidence = prioritizeEvidenceQueue(evidenceCandidates);
  const evidenceQueue = prioritizedEvidence.filter(needsEvidenceTask).slice(0, 3);
  const evidenceStack = prioritizedEvidence.slice(0, 3);
  const totalEvidenceGapCount = evidenceCandidates.filter(needsEvidenceTask).length;
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
  const evidenceTodoBaseCount = todoCount + reproducingBaseCount;
  const notReadyBaseCount = quickBaseResults.filter((result) => {
    const config = parseResultConfig(result.config);
    return !config.manuscriptReady && !result.artifactPath;
  }).length;
  const speakableCount = quickBaseResults.filter((result) => {
    const config = parseResultConfig(result.config);
    return config.reproducibility === "verified" && (config.manuscriptReady || result.artifactPath);
  }).length;
  const selectedExperimentTitle = experiments.find((experiment) => experiment.id === experimentId)?.title;
  const selectedDatasetName = datasets.find((dataset) => dataset.id === datasetId)?.name;
  const figurePathCount = quickBaseResults.filter((result) => Boolean(result.artifactPath)).length;
  const missingFigurePathCount = quickBaseResults.filter((result) => !result.artifactPath).length;
  const missingReproCount = quickBaseResults.filter(
    (result) => parseResultConfig(result.config).reproducibility !== "verified",
  ).length;
  const missingWritingFlagCount = quickBaseResults.filter((result) => {
    const config = parseResultConfig(result.config);
    return Boolean(result.artifactPath) && !config.manuscriptReady;
  }).length;
  const figurePackResults = [...quickBaseResults]
    .filter((result) => result.artifactPath || parseResultConfig(result.config).manuscriptReady)
    .sort(
      (left, right) =>
        figurePackRank(left) - figurePackRank(right) ||
        right.updatedAt.getTime() - left.updatedAt.getTime(),
    )
    .slice(0, 3);
  const figureSignals: FigureEvidenceSignal[] = [
    {
      action: "看可讲结果",
      detail: "已复现，并且有图表路径或写作标记。",
      href: dataHref(currentFilters, { reproducibility: "verified", manuscript: "ready" }),
      icon: CheckCircle2,
      label: "可直接讲",
      tone: "evidence",
      value: `${speakableCount} 条`,
    },
    {
      action: "补路径",
      detail: "缺图表、表格、结果文件或输出目录路径。",
      href: dataHref(currentFilters, { reproducibility: undefined, manuscript: "not-ready" }),
      icon: Link2,
      label: "缺图表路径",
      tone: "figure",
      value: `${missingFigurePathCount} 条`,
    },
    {
      action: "补复现",
      detail: "未复现或还在复现中，先补对照和日志。",
      href: dataHref(currentFilters, { reproducibility: "todo", manuscript: undefined }),
      icon: RotateCcw,
      label: "待补可信度",
      tone: "repro",
      value: `${missingReproCount} 条`,
    },
    {
      action: "标素材",
      detail: "已有路径但还没确认能写进组会/周报/论文。",
      href: dataHref(currentFilters, { reproducibility: undefined, manuscript: "ready" }),
      icon: FileText,
      label: "待写作标记",
      tone: "writing",
      value: `${missingWritingFlagCount} 条`,
    },
  ];
  const datasetHealthCandidates = prioritizeDatasetHealth(datasets, allResultSources);
  const traceableDatasetCount = datasetHealthCandidates.filter((item) => item.missing.length === 0).length;
  const missingLocationCount = datasets.filter((dataset) => !dataset.path && !dataset.externalUrl).length;
  const missingVersionCount = datasets.filter((dataset) => !dataset.version || !dataset.source).length;
  const unlinkedDatasetCount = datasetHealthCandidates.filter((item) => item.linkedResultCount === 0).length;
  const unscopedResultCount = allResultSources.filter((result) => !result.datasetId).length;
  const datasetHealthSignals: DatasetHealthSignal[] = [
    {
      action: "补路径",
      detail: "至少留下服务器路径、NAS 路径、DOI、OSF 或云盘入口之一。",
      href: "/data",
      icon: Link2,
      label: "缺数据位置",
      tone: "location",
      value: `${missingLocationCount} 个`,
    },
    {
      action: "补来源",
      detail: "来源和版本能帮你半年后判断这批数据还能不能复现。",
      href: "/data",
      icon: Database,
      label: "缺来源/版本",
      tone: "version",
      value: `${missingVersionCount} 个`,
    },
    {
      action: "关联结果",
      detail: "没有关联结果的数据源，写周报和论文时很难证明它被用在哪里。",
      href: "/data",
      icon: FileChartColumn,
      label: "未关联结果",
      tone: "result",
      value: `${unlinkedDatasetCount} 个`,
    },
    {
      action: "固定来源",
      detail: "结果没有固定数据来源时，后续图表、复现和交接最容易断线。",
      href: "/data",
      icon: AlertCircle,
      label: "结果缺来源",
      tone: "link",
      value: `${unscopedResultCount} 条`,
    },
  ];

  return (
    <div className="grid gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="research-eyebrow">
                <FileChartColumn className="size-3.5" />
                结果证据台
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                指标 · 复现 · 论文素材
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              先判断能不能讲，再决定要不要写。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              指标、复现、图表、结论四件事够用。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <CreateDialog
                title="记录一条证据"
                description="只填最关键的指标、复现状态和一句话结论，先判断能不能讲。"
                label="记录证据"
                icon={Plus}
                wide
                triggerVariant="default"
                triggerClassName="shadow-[0_10px_22px_rgba(47,72,88,0.16)]"
              >
                <ResultForm
                  action={createResult}
                  datasets={datasets}
                  experiments={experiments}
                />
              </CreateDialog>
              <CreateDialog
                title="补充数据来源"
                description="只有当结果需要固定数据来源或版本时，再补这一步。"
                label="补数据来源"
                icon={Database}
                triggerClassName="bg-white/64 text-muted-foreground"
              >
                <DatasetForm action={createDataset} />
              </CreateDialog>
              <form action={createResultBriefNote} className="contents">
                {filteredResults.slice(0, 12).map((result) => (
                  <input key={result.id} type="hidden" name="ids" value={result.id} />
                ))}
                <Button type="submit" variant="outline" disabled={!filteredResults.length}>
                  <ClipboardList className="size-4" />
                  收成汇报清单
                </Button>
              </form>
            </div>
            {brief === "empty" ? (
              <p className="mt-3 inline-flex rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                暂无可生成结果
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
                      detail={`${resultActionLabel(result)} · ${
                        result.experiment?.title ?? result.dataset?.name ?? "未关联来源"
                      }`}
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

      <CaptureNotice kind={captured} />

      <FigureEvidencePack
        evidenceQueue={evidenceQueue}
        figurePathCount={figurePathCount}
        figureResults={figurePackResults}
        reportResults={filteredResults.slice(0, 12)}
        signals={figureSignals}
      />

      <DatasetHealthBoard
        candidates={datasetHealthCandidates}
        signals={datasetHealthSignals}
        totalDatasets={datasets.length}
        traceableDatasetCount={traceableDatasetCount}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(20rem,0.35fr)_minmax(0,0.65fr)]">
        <aside className="grid min-w-0 content-start gap-4">
          <QuickResultCapture />

          <Card className="workbench-card overflow-hidden">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" />
                证据可讲度
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <EvidenceTalkabilityStep
                index="01"
                title="可以讲"
                value={`${speakableCount} 条`}
                detail="已复现，并且有图表路径或写作标记。"
                href={dataHref(currentFilters, { reproducibility: "verified", manuscript: "ready" })}
                tone="green"
              />
              <EvidenceTalkabilityStep
                index="02"
                title="先判定"
                value={`${unknownCount} 条`}
                detail="还没判断是否值得投入复现或汇报。"
                href={dataHref(currentFilters, { reproducibility: "unknown", manuscript: undefined })}
                tone="warm"
              />
              <EvidenceTalkabilityStep
                index="03"
                title="补可信度"
                value={`${evidenceTodoBaseCount} 条`}
                detail="待复现或复现中，先补对照和日志。"
                href={dataHref(currentFilters, { reproducibility: "todo", manuscript: undefined })}
                tone="blue"
              />
              <EvidenceTalkabilityStep
                index="04"
                title="补素材"
                value={`${notReadyBaseCount} 条`}
                detail="缺图表路径或写作标记，汇报前容易找不到。"
                href={dataHref(currentFilters, { reproducibility: undefined, manuscript: "not-ready" })}
                tone="quiet"
              />
            </CardContent>
          </Card>

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
                  <div key={result.id} className="soft-tile rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="line-clamp-1 font-medium">{result.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {resultActionLabel(result)} ·{" "}
                          {result.experiment?.title ?? result.dataset?.name ?? "未关联来源"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {resultActionReason(result)}
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
                筛选捷径
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
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

        <div className="grid min-w-0 gap-4">
          <section className="grid gap-3 rounded-2xl border border-border/65 bg-white/74 p-3 shadow-[0_12px_30px_rgba(27,42,56,0.045)]">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold hero-title">
                  <Target className="size-4 text-primary" />
                  三条结果证据缺口
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  从全库结果里优先挑 3 条最该收口的证据，不受当前筛选影响。先把复现、图表路径和写作素材补齐。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-fit rounded-full border border-[#d5e4e8] bg-[#eef6f4] px-2.5 py-1 text-xs font-medium text-[#315266]">
                  全库待补 {totalEvidenceGapCount} 条
                </span>
                {evidenceQueue.length ? (
                  <form action={createResultCloseoutNote}>
                    {evidenceQueue.map((result) => (
                      <input key={result.id} type="hidden" name="ids" value={result.id} />
                    ))}
                    <Button type="submit" variant="outline" size="sm" className="bg-white/82">
                      <FileCheck2 className="size-3.5" />
                      生成证据清单
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
            {evidenceQueue.length ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {evidenceQueue.map((result, index) => (
                  <EvidenceCloseoutCard
                    key={result.id}
                    result={result}
                    index={index + 1}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="暂时没有明显证据缺口"
                description="当前结果已经比较完整。可以继续记录新结果，或把已复现结果整理成写作素材。"
              />
            )}
          </section>

          {filteredResults.length ? (
            <section className="grid gap-3 rounded-2xl border border-border/65 bg-white/70 p-3 shadow-[0_10px_24px_rgba(34,48,71,0.035)] md:grid-cols-3">
              <EvidenceGapCard
                icon={AlertCircle}
                label="先判定"
                value={`${unknownCount} 条`}
                detail="还没判断是否值得复现、汇报或放弃"
                href={dataHref(currentFilters, { reproducibility: "unknown", manuscript: undefined })}
                tone="warm"
              />
              <EvidenceGapCard
                icon={RotateCcw}
                label="补复现"
                value={`${evidenceTodoBaseCount} 条`}
                detail="待复现或复现中的结果，需要先收成可信证据"
                href={dataHref(currentFilters, { reproducibility: "todo", manuscript: undefined })}
                tone="blue"
              />
              <EvidenceGapCard
                icon={FileChartColumn}
                label="补素材"
                value={`${notReadyBaseCount} 条`}
                detail="缺图表路径或写作标记，组会前会难追溯"
                href={dataHref(currentFilters, { reproducibility: undefined, manuscript: "not-ready" })}
                tone="green"
              />
            </section>
          ) : null}

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
              <option value="">全部来源</option>
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
              <TabsTrigger value="results">结果证据</TabsTrigger>
              <TabsTrigger value="manuscript">论文素材</TabsTrigger>
              <TabsTrigger value="datasets">数据来源</TabsTrigger>
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
                  title={activeFilterCount ? "没有匹配的结果证据" : "暂无结果证据"}
                  description={
                    activeFilterCount
                      ? "试着清除筛选，或换一个复现状态、实验、数据来源再看。"
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
                  title="暂无数据来源"
                  description="只有当结果需要固定数据来源或版本时，再补充来源信息。"
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}

function FigureEvidencePack({
  evidenceQueue,
  figurePathCount,
  figureResults,
  reportResults,
  signals,
}: {
  evidenceQueue: ResultFull[];
  figurePathCount: number;
  figureResults: ResultFull[];
  reportResults: ResultFull[];
  signals: FigureEvidenceSignal[];
}) {
  return (
    <section className="figure-pack overflow-hidden rounded-3xl border border-border/60 p-4 shadow-[0_18px_42px_rgba(27,42,56,0.052)]">
      <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr] xl:items-stretch">
        <div className="figure-pack-lead rounded-2xl border border-white/70 p-4">
          <span className="research-eyebrow">
            <FileChartColumn className="size-3.5" />
            图表证据包
          </span>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight hero-title">
            结果要能讲、能追溯，也能直接进入图表和论文。
          </h2>
          <p className="mt-3 text-sm leading-6 hero-copy">
            不做完整数据平台，只把图表路径、复现状态和一句话结论收口。
            组会前先生成清单，缺路径或缺复现的结果马上变成待补任务。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">已有图表路径</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{figurePathCount}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">当前清单候选</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{reportResults.length}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <form action={createResultBriefNote}>
              {reportResults.map((result) => (
                <input key={result.id} type="hidden" name="ids" value={result.id} />
              ))}
              <SubmitButton className="w-full" disabled={!reportResults.length}>
                <ClipboardList className="size-4" />
                收成图表清单
              </SubmitButton>
            </form>
            {evidenceQueue.length ? (
              <form action={createResultCloseoutNote}>
                {evidenceQueue.map((result) => (
                  <input key={result.id} type="hidden" name="ids" value={result.id} />
                ))}
                <SubmitButton variant="outline" className="w-full bg-white/72">
                  <FileCheck2 className="size-4" />
                  补证据缺口
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {signals.map((signal) => (
              <FigureEvidenceSignalCard key={signal.label} {...signal} />
            ))}
          </div>

          <div className="grid gap-2 rounded-2xl border border-white/72 bg-white/60 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] lg:grid-cols-3">
            {figureResults.length ? (
              figureResults.map((result, index) => {
                const config = parseResultConfig(result.config);

                return (
                  <div key={result.id} className="rounded-xl border border-white/74 bg-white/66 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-primary">
                        0{index + 1}
                      </span>
                      <ReproducibilityBadge result={result} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold hero-title">{result.title}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {result.experiment?.title ?? result.dataset?.name ?? "未关联来源"}
                    </p>
                    <div className="mt-3 grid gap-2 text-xs leading-5 text-muted-foreground">
                      <div className="flex items-start gap-2 rounded-lg border border-[#d5e4e8] bg-[#f5fafb] px-2.5 py-2">
                        <Link2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span className="line-clamp-2 break-all">
                          {result.artifactPath ?? "缺图表、表格或结果目录路径"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-[#d5e4e8] bg-white/72 px-2.5 py-2">
                        <FileText className="size-3.5 shrink-0 text-primary" />
                        <span>
                          {config.manuscriptReady ? "已标记为写作素材" : "还没确认能写进论文或组会"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end border-t border-border/60 pt-3">
                      <CreateWritingNoteFromResultButton result={result} />
                    </div>
                  </div>
                );
              })
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function FigureEvidenceSignalCard({
  action,
  detail,
  href,
  icon: Icon,
  label,
  tone,
  value,
}: FigureEvidenceSignal) {
  return (
    <Link href={href} className="figure-signal-card group">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${figureSignalToneClass(tone)}`}>
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-sm font-semibold hero-title">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
        {action}
        <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function figureSignalToneClass(tone: FigureEvidenceSignal["tone"]) {
  return {
    evidence: "border-[#d5e8d6] bg-[#eef8ed] text-[#3f6c4d]",
    figure: "border-[#d3e2ee] bg-[#eef6fb] text-[#365a7d]",
    repro: "border-[#ead9ad] bg-[#fff8e7] text-[#765a23]",
    writing: "border-[#d9d4ea] bg-[#f3f1fb] text-[#5a4b83]",
  }[tone];
}

function figurePackRank(result: ResultFull) {
  const config = parseResultConfig(result.config);
  const reproducibility = config.reproducibility ?? "unknown";
  const reproducibilityRank: Record<string, number> = {
    verified: 0,
    reproducing: 1,
    todo: 2,
    unknown: 3,
  };
  const figureBonus = result.artifactPath ? -0.4 : 0;
  const writingBonus = config.manuscriptReady ? -0.2 : 0;

  return (reproducibilityRank[reproducibility] ?? 3) + figureBonus + writingBonus;
}

function DatasetHealthBoard({
  candidates,
  signals,
  totalDatasets,
  traceableDatasetCount,
}: {
  candidates: DatasetHealthCandidate[];
  signals: DatasetHealthSignal[];
  totalDatasets: number;
  traceableDatasetCount: number;
}) {
  const topCandidate = candidates[0];
  const riskyCandidates = candidates.filter((candidate) => candidate.missing.length > 0).slice(0, 4);

  return (
    <section className="dataset-health-board overflow-hidden rounded-3xl border border-border/60 p-4 shadow-[0_18px_42px_rgba(27,42,56,0.048)]">
      <div className="grid gap-4 xl:grid-cols-[0.32fr_0.68fr] xl:items-stretch">
        <div className="dataset-health-lead rounded-2xl border border-white/70 p-4">
          <span className="research-eyebrow">
            <Database className="size-3.5" />
            数据来源体检台
          </span>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight hero-title">
            别做完整数据仓库，只保证以后能找回、复现和解释来源。
          </h2>
          <p className="mt-3 text-sm leading-6 hero-copy">
            研究数据最常见的断点是路径、版本、来源和结果关联缺失。这里把缺口前置，
            需要时一键生成复现清单，不增加日常录入负担。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">可追溯来源</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">
                {traceableDatasetCount}
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">数据源总数</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{totalDatasets}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {topCandidate ? (
              <form action={createDatasetAuditNote}>
                <input type="hidden" name="id" value={topCandidate.dataset.id} />
                <SubmitButton className="w-fit">
                  <FileCheck2 className="size-4" />
                  生成体检清单
                </SubmitButton>
              </form>
            ) : null}
            <Button variant="outline" className="bg-white/68" render={<Link href="/data" />}>
              <Database className="size-4" />
              看数据来源
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {signals.map((signal) => (
              <DatasetHealthSignalCard key={signal.label} signal={signal} />
            ))}
          </div>

          <div className="grid gap-2 rounded-2xl border border-white/72 bg-white/58 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold hero-title">优先体检数据源</p>
              <span className="rounded-full border border-white/72 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                最多 4 个
              </span>
            </div>
            {riskyCandidates.length ? (
              <div className="grid gap-2 lg:grid-cols-2">
                {riskyCandidates.map((candidate) => (
                  <DatasetHealthCandidateCard key={candidate.dataset.id} candidate={candidate} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function DatasetHealthSignalCard({ signal }: { signal: DatasetHealthSignal }) {
  const Icon = signal.icon;
  const tone = datasetHealthToneClass(signal.tone);

  return (
    <Link href={signal.href} className={cn("dataset-health-signal group", tone.card)}>
      <span className="flex items-start justify-between gap-3">
        <span className={cn("dataset-health-icon", tone.icon)}>
          <Icon className="size-4" />
        </span>
        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", tone.pill)}>
          {signal.value}
        </span>
      </span>
      <span className="mt-4 block">
        <span className="text-base font-semibold leading-snug hero-title">{signal.label}</span>
        <span className="mt-2 block line-clamp-3 text-xs leading-5 text-muted-foreground">
          {signal.detail}
        </span>
      </span>
      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold text-primary">
        {signal.action}
        <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function DatasetHealthCandidateCard({ candidate }: { candidate: DatasetHealthCandidate }) {
  const { dataset, latestResultAt, linkedResultCount, missing } = candidate;

  return (
    <div className="grid gap-3 rounded-xl border border-white/72 bg-white/66 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm font-semibold hero-title">{dataset.name}</p>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {dataset.source || "来源未填"} · {dataset.version || "版本未填"}
          </p>
        </div>
        <span className="rounded-full border border-[#d5e4e8] bg-[#eef6f4] px-2 py-0.5 text-xs font-semibold text-primary">
          {linkedResultCount} 结果
        </span>
      </div>

      <div className="grid gap-2 text-xs leading-5 text-muted-foreground">
        <div className="flex items-start gap-2 rounded-lg border border-[#d5e4e8] bg-[#f8fbf8]/78 px-2.5 py-2">
          <Link2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span className="line-clamp-2 break-all">
            {dataset.path || dataset.externalUrl || "缺少服务器路径、NAS 路径、DOI、OSF 或云盘入口"}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#d5e4e8] bg-white/72 px-2.5 py-2">
          <FileChartColumn className="size-3.5 shrink-0 text-primary" />
          <span>
            {latestResultAt
              ? `最近结果更新 ${formatDateTime(latestResultAt)}`
              : "还没有结果固定到这个数据源"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {missing.length ? (
          missing.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[#ead8ac] bg-[#fff8e7] px-2 py-0.5 text-[11px] font-medium text-[#765a23]"
            >
              缺{item}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            来源已闭环
          </span>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
        <form action={createDatasetAuditNote}>
          <input type="hidden" name="id" value={dataset.id} />
          <Button type="submit" variant="outline" size="sm">
            <FileCheck2 className="size-3.5" />
            体检清单
          </Button>
        </form>
        <CreateDialog title="补数据来源" label="补信息" icon={Edit3}>
          <DatasetForm action={updateDataset} dataset={dataset} />
        </CreateDialog>
      </div>
    </div>
  );
}

function datasetHealthToneClass(tone: DatasetHealthSignal["tone"]) {
  return {
    link: {
      card: "from-[#fffbf0] to-[#f6f0de]",
      icon: "border-[#ead9ad] bg-[#fff8e7] text-[#765a23]",
      pill: "border-[#ead9ad] bg-[#fff8e7] text-[#765a23]",
    },
    location: {
      card: "from-[#f9fbff] to-[#eef5fb]",
      icon: "border-[#d3e2ee] bg-[#eef6fb] text-[#365a7d]",
      pill: "border-[#d3e2ee] bg-[#eef6fb] text-[#365a7d]",
    },
    result: {
      card: "from-[#fbfff8] to-[#eef7ed]",
      icon: "border-[#d5e8d6] bg-[#eef8ed] text-[#3f6c4d]",
      pill: "border-[#d5e8d6] bg-[#eef8ed] text-[#3f6c4d]",
    },
    version: {
      card: "from-[#fbf9ff] to-[#f0edf8]",
      icon: "border-[#ded6ec] bg-[#f4efff] text-[#5f4f84]",
      pill: "border-[#ded6ec] bg-[#f4efff] text-[#5f4f84]",
    },
  }[tone];
}

function prioritizeDatasetHealth(datasets: Dataset[], results: ResultFull[]) {
  return datasets
    .map<DatasetHealthCandidate>((dataset) => {
      const linkedResults = results.filter((result) => result.datasetId === dataset.id);
      const latestResultAt =
        linkedResults
          .map((result) => result.updatedAt)
          .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
      const missing = datasetHealthMissing(dataset, linkedResults.length);

      return {
        dataset,
        latestResultAt,
        linkedResultCount: linkedResults.length,
        missing,
        score: datasetHealthScore(dataset, linkedResults.length),
      };
    })
    .sort((left, right) => {
      const score = right.score - left.score;
      if (score !== 0) return score;

      return right.dataset.updatedAt.getTime() - left.dataset.updatedAt.getTime();
    });
}

function datasetHealthMissing(dataset: Dataset, linkedResultCount: number) {
  const missing: string[] = [];

  if (!dataset.path && !dataset.externalUrl) missing.push("位置");
  if (!dataset.source) missing.push("来源");
  if (!dataset.version) missing.push("版本");
  if (linkedResultCount === 0) missing.push("结果");

  return missing;
}

function datasetHealthScore(dataset: Dataset, linkedResultCount: number) {
  return (
    (!dataset.path && !dataset.externalUrl ? 5 : 0) +
    (!dataset.source ? 3 : 0) +
    (!dataset.version ? 3 : 0) +
    (linkedResultCount === 0 ? 4 : 0)
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

function QuickResultCapture() {
  return (
    <Card className="workbench-card border-primary/12 bg-[linear-gradient(135deg,rgba(239,247,247,0.94),rgba(255,250,238,0.76))]">
      <CardHeader className="border-b border-white/70 bg-white/38 pb-4">
        <CardTitle className="flex items-center gap-2">
          <FileChartColumn className="size-4 text-primary" />
          60 秒记录证据
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createResult} className="grid gap-3">
          <Field label="一句话结果">
            <Input
              name="title"
              required
              placeholder="例如：Ablation 后 F1 下降 3.2%"
              className="h-10 border-[#cadbe1] bg-white/92 font-medium"
            />
          </Field>

          <input type="hidden" name="experimentId" value="" />
          <input type="hidden" name="datasetId" value="" />
          <input type="hidden" name="metrics" value="{}" />
          <input type="hidden" name="config" value="{}" />

          <div className="grid gap-2 sm:grid-cols-[1fr_0.8fr]">
            <Field label="指标">
              <Input
                name="metricName"
                placeholder="F1 / RMSE / Accuracy"
                className="h-9 border-[#d4e0e5] bg-white/90"
              />
            </Field>
            <Field label="数值">
              <Input
                name="metricValue"
                placeholder="0.86 / -3.2%"
                className="h-9 border-[#d4e0e5] bg-white/90"
              />
            </Field>
          </div>

          <Field label="复现状态">
            <select
              name="reproducibility"
              defaultValue="unknown"
              className="h-9 rounded-lg border border-[#d4e0e5] bg-white/90 px-2 text-sm outline-none transition focus:border-primary/40 focus:ring-3 focus:ring-ring/18"
            >
              {reproducibilityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="图表或文件路径">
            <Input
              name="artifactPath"
              placeholder="figures/result.png 或结果目录"
              className="h-9 border-[#d4e0e5] bg-white/90"
            />
          </Field>

          <Textarea
            name="notes"
            rows={3}
            placeholder={"结论：\n下一步："}
            className="min-h-24 resize-none border-[#d4e0e5] bg-white/90 text-sm leading-6"
          />

          <div className="flex items-start gap-2 rounded-xl border border-[#d5e4e8] bg-white/58 px-3 py-2 text-xs leading-5 text-muted-foreground">
            <input type="checkbox" name="manuscriptReady" value="true" className="mt-0.5 size-4 shrink-0" />
            <span>这条结果已经能进入组会、周报或论文素材。</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d5e4e8] bg-white/58 px-3 py-2">
            <p className="text-xs leading-5 text-muted-foreground">
              先收住证据，关联实验和数据来源之后再补。
            </p>
            <SubmitButton className="w-fit">加入证据台</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function WorkflowTip({ title, text: _text }: { title: string; text: string }) {
  return (
    <div className="soft-tile rounded-xl p-3">
      <p className="font-medium">{title}</p>
      <p className="sr-only">{_text}</p>
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
          ? "flex items-center justify-between rounded-xl border border-primary/25 bg-[#eef4eb] px-3 py-2 text-sm font-medium text-primary"
          : "flex items-center justify-between soft-tile rounded-xl px-3 py-2 text-sm transition hover:border-primary/25 hover:bg-white"
      }
    >
      <span>{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </Link>
  );
}

function EvidenceTalkabilityStep({
  detail,
  href,
  index,
  title,
  tone,
  value,
}: {
  detail: string;
  href: string;
  index: string;
  title: string;
  tone: "blue" | "green" | "quiet" | "warm";
  value: string;
}) {
  const toneClass = {
    blue: "border-[#cfe0e4] bg-[#eef6f7] text-[#315266]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    quiet: "border-border/70 bg-white/72 text-muted-foreground",
    warm: "border-[#ead8ac] bg-[#fff8e8] text-[#7a5a2f]",
  }[tone];

  return (
    <Link
      href={href}
      className="group flex gap-2 rounded-xl border border-border/66 bg-[#fffef9]/72 p-2.5 transition hover:border-primary/25 hover:bg-white"
    >
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] font-semibold ${toneClass}`}>
        {index}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--workspace-title)]">{title}</span>
          <span className="shrink-0 rounded-full border border-border/70 bg-white/80 px-2 py-0.5 text-[11px] text-muted-foreground">
            {value}
          </span>
        </span>
        <span className="sr-only">
          {detail}
        </span>
      </span>
    </Link>
  );
}

function EvidenceGapCard({
  icon: Icon,
  label,
  value,
  detail,
  href,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  href: string;
  tone: "blue" | "warm" | "green";
}) {
  const toneClass = {
    blue: "border-[#d5e4e8] bg-[#eef6f7] text-primary",
    warm: "border-[#edd8a5] bg-[#fff7df] text-[#7a5a2f]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <Link
      href={href}
      className="group grid gap-3 rounded-xl border border-border/70 bg-white/74 p-3 transition hover:border-primary/25 hover:bg-white"
    >
      <span className="flex items-center justify-between gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
          <Icon className="size-4" />
        </span>
        <span className="rounded-full border bg-white/80 px-2.5 py-1 text-xs font-medium text-primary">
          {value}
        </span>
      </span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="sr-only">{detail}</span>
      </span>
    </Link>
  );
}

function EvidenceCloseoutCard({
  result,
  index,
}: {
  result: ResultFull;
  index: number;
}) {
  const actionLabel = resultActionLabel(result);
  const actionReason = resultActionReason(result);

  return (
    <Card className="workbench-card border-[#d7e3e8]/90 bg-white/84">
      <CardContent className="grid h-full gap-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#d5e4e8] bg-[#eef6f4] font-mono text-xs font-semibold text-[#315266]">
            0{index}
          </span>
          <ReproducibilityBadge result={result} />
        </div>

        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-5">{result.title}</p>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {result.experiment?.title ?? result.dataset?.name ?? "未关联来源"}
          </p>
        </div>

        <div className="rounded-xl border border-[#d5e4e8] bg-[#f5fafb] p-3">
          <p className="text-sm font-medium text-[var(--workspace-title)]">{actionLabel}</p>
          <p className="mt-1 inline-flex rounded-lg border border-[#d5e4e8] bg-white/65 px-2 py-0.5 text-xs leading-5 text-muted-foreground">
            {actionReason}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-border/65 pt-3">
          <CreateWritingNoteFromResultButton result={result} />
          {needsEvidenceTask(result) ? (
            <CreateTaskFromResultButton result={result} compact />
          ) : null}
        </div>
      </CardContent>
    </Card>
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
  const actionReason = resultActionReason(result);

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
              {result.dataset?.name ?? "未关联来源"} · 更新 {formatDateTime(result.updatedAt)}
            </p>
          </div>
          <MetricPills metrics={metrics} />
        </div>

        {result.notes ? (
          <p className="soft-tile rounded-xl p-3 text-sm leading-6 text-muted-foreground">
            {result.notes}
          </p>
        ) : null}

        {result.artifactPath ? (
          <p className="flex items-center gap-2 rounded-xl border border-border/72 bg-white/70 p-3 text-sm text-muted-foreground">
            <Link2 className="size-4 shrink-0" />
            <span className="break-all">{result.artifactPath}</span>
          </p>
        ) : null}

        <div className="rounded-xl border border-[#d5e4e8] bg-[#f5fafb] p-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#d5e4e8] bg-white/72 text-primary">
              <Target className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{nextAction}</p>
              <p className="mt-1 inline-flex rounded-lg border border-[#d5e4e8] bg-white/65 px-2 py-0.5 text-xs leading-5 text-muted-foreground">{actionReason}</p>
            </div>
          </div>
        </div>

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
          <p className="flex items-center gap-2 soft-tile rounded-xl p-3 text-sm text-muted-foreground">
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

function resultActionReason(result: ResultFull) {
  const config = parseResultConfig(result.config);
  const reproducibility = config.reproducibility ?? "unknown";

  if (reproducibility === "unknown") {
    return "待判定";
  }

  if (reproducibility === "todo") {
    return "待复现";
  }

  if (reproducibility === "reproducing") {
    return "复现中";
  }

  if (!result.artifactPath) {
    return "缺路径";
  }

  if (!config.manuscriptReady) {
    return "待写作";
  }

  return "可讲";
}

function prioritizeEvidenceQueue(results: ResultFull[]) {
  return [...results].sort((left, right) => {
    const rank = resultEvidenceRank(left) - resultEvidenceRank(right);
    if (rank !== 0) return rank;

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
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
          <form action={createDatasetAuditNote}>
            <input type="hidden" name="id" value={dataset.id} />
            <Button type="submit" variant="outline" size="sm">
              <FileCheck2 className="size-3.5" />
              复现清单
            </Button>
          </form>
          <CreateDialog title="编辑数据来源" label="编辑" icon={Edit3}>
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
    <form action={action} className="grid gap-4">
      {dataset ? <input type="hidden" name="id" value={dataset.id} /> : null}

      <div className="rounded-2xl border border-[#d5e4e8] bg-[#f8fbf8]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#cfe0e4] bg-white text-primary">
            <Database className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--workspace-title)]">
              {dataset ? "调整数据来源卡" : "登记一个会影响结果复现的数据来源"}
            </p>
            <p className="sr-only">
              只登记关键数据版本和位置，细节文档继续放在实验记录或数据目录里。
            </p>
          </div>
        </div>
        <Input
          name="name"
          required
          defaultValue={dataset?.name ?? ""}
          placeholder="例如：2026-05 清洗后岩石破裂图像数据"
          className="mt-3 h-11 border-[#cadbe1] bg-white/92 text-base font-medium"
        />
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-white/72 p-3 md:grid-cols-2">
        <Field label="来源">
          <Input
            name="source"
            defaultValue={dataset?.source ?? ""}
            placeholder="实验台架 / 公开数据 / 仿真输出"
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
        <Field label="版本">
          <Input
            name="version"
            defaultValue={dataset?.version ?? ""}
            placeholder="例如：v1.2 / 2026-05-30 / clean-final"
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_0.8fr]">
        <Field label="本地位置或服务器路径" hint="写能让你以后找回数据的位置，不需要上传文件。">
          <Input
            name="path"
            defaultValue={dataset?.path ?? ""}
            placeholder="例如：/data/rock/clean/v1 或 NAS 路径"
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
        <Field label="外部链接">
          <Input
            name="externalUrl"
            defaultValue={dataset?.externalUrl ?? ""}
            placeholder="DOI / OSF / GitHub / 云盘链接"
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
      </div>

      <Field label="标签">
        <Input
          name="tags"
          defaultValue={parseTags(dataset?.tags).join(", ")}
          placeholder="实验, 清洗后, baseline"
          className="h-9 border-[#d4e0e5] bg-white/90"
        />
      </Field>

      <Field
        label="复现说明"
        hint="写清它用于哪个实验、是否清洗、是否可公开、哪些结果依赖它。"
      >
        <Textarea
          name="description"
          rows={5}
          defaultValue={dataset?.description ?? ""}
          placeholder={"用途：\n处理状态：\n依赖结果："}
          className="min-h-36 border-[#d4e0e5] bg-[#fffef9]/96 leading-6"
        />
      </Field>

      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-[#d5e4e8] bg-[#eef6f4] px-3 py-2">
        <p className="sr-only">
          <Link2 className="size-3.5 shrink-0" />
          保存后可在结果证据卡里关联，帮助以后追溯图表和复现实验。
        </p>
        <SubmitButton>{dataset ? "保存来源" : "登记来源"}</SubmitButton>
      </div>
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
    <form action={action} className="grid gap-4">
      {result ? <input type="hidden" name="id" value={result.id} /> : null}

      <div className="rounded-2xl border border-[#d5e4e8] bg-[#f8fbf8]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#cfe0e4] bg-white text-primary">
            <FileChartColumn className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--workspace-title)]">
              {result ? "调整结果证据卡" : "记录一条能讲清楚的结果"}
            </p>
          </div>
        </div>
        <Input
          name="title"
          required
          defaultValue={result?.title ?? ""}
          placeholder="例如：去掉注意力模块后 F1 下降 3.2%，说明模块有效"
          className="mt-3 h-11 border-[#cadbe1] bg-white/92 text-base font-medium"
        />
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-white/72 p-3 md:grid-cols-3">
        <Field label="关联实验">
          <select
            name="experimentId"
            defaultValue={result?.experimentId ?? ""}
            className="h-9 min-w-0 rounded-lg border border-[#d4e0e5] bg-white/90 px-2 text-sm outline-none transition focus:border-primary/40 focus:ring-3 focus:ring-ring/18"
          >
            <option value="">暂不关联实验</option>
            {experiments.map((experiment) => (
              <option key={experiment.id} value={experiment.id}>
                {experiment.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="数据来源">
          <select
            name="datasetId"
            defaultValue={result?.datasetId ?? ""}
            className="h-9 min-w-0 rounded-lg border border-[#d4e0e5] bg-white/90 px-2 text-sm outline-none transition focus:border-primary/40 focus:ring-3 focus:ring-ring/18"
          >
            <option value="">暂不固定来源</option>
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
            className="h-9 rounded-lg border border-[#d4e0e5] bg-white/90 px-2 text-sm outline-none transition focus:border-primary/40 focus:ring-3 focus:ring-ring/18"
          >
            {reproducibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-2 rounded-2xl border border-[#d5e4e8] bg-[#fbfcfd]/86 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--workspace-title)]">
              <BarChart3 className="size-4 text-primary" />
              核心指标
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              填 1-3 个最关键指标即可，用来判断能否进入组会、周报或论文素材。
            </p>
          </div>
          <span className="rounded-full border border-[#d8e5ee] bg-white px-2 py-0.5 text-[11px] text-muted-foreground">
            evidence
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {metricRows.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr] gap-2">
              <Input
                name="metricName"
                defaultValue={row.name}
                placeholder={index === 0 ? "指标名，如 F1" : "指标名"}
                className="h-9 border-[#d4e0e5] bg-white/90"
              />
              <Input
                name="metricValue"
                defaultValue={row.value}
                placeholder={index === 0 ? "数值，如 0.86" : "数值"}
                className="h-9 border-[#d4e0e5] bg-white/90"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_0.72fr]">
        <Field
          label="图表或结果文件"
          hint="写可追溯路径，不上传文件；例如图表、CSV、实验输出目录。"
        >
          <Input
            name="artifactPath"
            defaultValue={result?.artifactPath ?? ""}
            placeholder="例如：figures/ablation_attention.png 或服务器结果路径"
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
        <label className="flex min-h-[4.75rem] items-start gap-2 rounded-xl border border-[#d5e4e8] bg-[#eef6f4] px-3 py-3 text-sm text-[#315266]">
          <input
            type="checkbox"
            name="manuscriptReady"
            value="true"
            defaultChecked={Boolean(config.manuscriptReady)}
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            <span className="block font-medium">可写入组会/周报/论文</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              勾选前确认路径、指标和复现状态足够支撑结论。
            </span>
          </span>
        </label>
      </div>

      <Field
        label="一句话结论与下一步"
        hint="建议写成：结论是什么、能支撑哪个判断、下一步补什么证据。"
      >
        <Textarea
          name="notes"
          rows={5}
          defaultValue={result?.notes ?? ""}
          placeholder={"结论：\n支撑：\n下一步："}
          className="min-h-36 border-[#d4e0e5] bg-[#fffef9]/96 leading-6"
        />
      </Field>
      <input type="hidden" name="metrics" value={result?.metrics ?? "{}"} />
      <input type="hidden" name="config" value={result?.config ?? "{}"} />

      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-[#d5e4e8] bg-[#eef6f4] px-3 py-2">
        <p className="sr-only">
          <FileCheck2 className="size-3.5 shrink-0" />
          保存后可生成证据任务、写作素材或结果汇总笔记。
        </p>
        <SubmitButton>{result ? "保存证据" : "加入证据台"}</SubmitButton>
      </div>
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
