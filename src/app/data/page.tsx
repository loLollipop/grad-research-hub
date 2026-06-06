import { Database, Trash2 } from "lucide-react";
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
import { Field } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
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

export default async function DataPage() {
  const [datasets, experiments, results] = await Promise.all([
    prisma.dataset.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.experiment.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.result.findMany({
      orderBy: { updatedAt: "desc" },
      include: { experiment: true, dataset: true },
    }),
  ]);

  const chartData = results[0] ? metricsFromJson(results[0].metrics) : [];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Research Data"
        title="数据与结果"
        description="登记数据集位置、实验配置和指标结果，形成可复盘的结果对比表。"
      />

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-4">
          <Card className="rounded-lg bg-white/95">
            <CardHeader>
              <CardTitle>登记数据集</CardTitle>
            </CardHeader>
            <CardContent>
              <DatasetForm action={createDataset} />
            </CardContent>
          </Card>
          <Card className="rounded-lg bg-white/95">
            <CardHeader>
              <CardTitle>记录实验结果</CardTitle>
            </CardHeader>
            <CardContent>
              <ResultForm
                action={createResult}
                datasets={datasets}
                experiments={experiments}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="rounded-lg bg-white/95">
            <CardHeader>
              <CardTitle>最近结果指标</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length ? (
                <ResultMetricsChart data={chartData} />
              ) : (
                <EmptyState
                  icon={Database}
                  title="暂无指标"
                  description="添加一条结果后，这里会展示最近结果的指标图。"
                />
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="results">
            <TabsList>
              <TabsTrigger value="results">结果对比</TabsTrigger>
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
                  icon={Database}
                  title="暂无结果"
                  description="记录实验指标后，可以在这里横向比较。"
                />
              )}
            </TabsContent>
            <TabsContent value="datasets" className="grid gap-3">
              {datasets.map((dataset) => (
                <Card key={dataset.id} className="rounded-lg bg-white/95">
                  <CardContent className="grid gap-3 py-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="font-semibold">{dataset.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {dataset.source ?? "来源未填"} · {dataset.version ?? "无版本"} ·{" "}
                          {dataset.path ?? "无路径"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          DVC {dataset.dvcPath ?? "未关联"} ·{" "}
                          {dataset.externalUrl ? (
                            <a
                              className="text-[#1f3d33] underline-offset-4 hover:underline"
                              href={dataset.externalUrl}
                            >
                              外部数据页
                            </a>
                          ) : (
                            "无外部链接"
                          )}
                        </p>
                      </div>
                      <TagList value={dataset.tags} />
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {dataset.description ?? "暂无描述。"}
                    </p>
                    <details className="rounded-md border p-3">
                      <summary className="cursor-pointer text-sm font-medium">编辑数据集</summary>
                      <div className="mt-3">
                        <DatasetForm action={updateDataset} dataset={dataset} />
                        <form action={deleteDataset} className="mt-3">
                          <input type="hidden" name="id" value={dataset.id} />
                          <Button type="submit" variant="destructive">
                            <Trash2 className="size-4" />
                            删除
                          </Button>
                        </form>
                      </div>
                    </details>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </section>
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

  return (
    <Card className="rounded-lg bg-white/95">
      <CardContent className="grid gap-3 py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-semibold">{result.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.experiment?.title ?? "未关联实验"} ·{" "}
              {result.dataset?.name ?? "未关联数据集"} · 更新 {formatDateTime(result.updatedAt)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              MLflow {result.mlflowRunId ?? "未关联"} · DVC {result.dvcExpName ?? "未关联"} · Git{" "}
              {result.gitCommit ?? "未记录"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(metrics).map(([key, value]) => (
              <span key={key} className="rounded-md border bg-[#fffdf7] px-2 py-1">
                {key}: {String(value)}
              </span>
            ))}
          </div>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{result.notes ?? "暂无备注。"}</p>
        {result.artifactPath ? (
          <p className="rounded-md border bg-[#fffdf7] px-3 py-2 text-xs text-muted-foreground">
            Artifact: {result.artifactPath}
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
                删除
              </Button>
            </form>
          </div>
        </details>
      </CardContent>
    </Card>
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
      <Field label="路径">
        <Input name="path" defaultValue={dataset?.path ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="外部链接">
          <Input name="externalUrl" defaultValue={dataset?.externalUrl ?? ""} />
        </Field>
        <Field label="DVC 路径">
          <Input name="dvcPath" defaultValue={dataset?.dvcPath ?? ""} />
        </Field>
      </div>
      <Field label="标签">
        <Input name="tags" defaultValue={parseTags(dataset?.tags).join(", ")} />
      </Field>
      <Field label="描述">
        <Textarea name="description" rows={3} defaultValue={dataset?.description ?? ""} />
      </Field>
      <SubmitButton>{dataset ? "保存数据集" : "登记数据集"}</SubmitButton>
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
  return (
    <form action={action} className="grid gap-3">
      {result ? <input type="hidden" name="id" value={result.id} /> : null}
      <Field label="结果名称">
        <Input name="title" required defaultValue={result?.title ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="实验">
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
      </div>
      <Field label="指标 JSON">
        <Textarea
          name="metrics"
          rows={3}
          defaultValue={result?.metrics ?? '{ "accuracy": 0.85, "f1": 0.8 }'}
        />
      </Field>
      <Field label="配置 JSON">
        <Textarea
          name="config"
          rows={3}
          defaultValue={result?.config ?? '{ "model": "baseline", "seed": 42 }'}
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="MLflow Run ID">
          <Input name="mlflowRunId" defaultValue={result?.mlflowRunId ?? ""} />
        </Field>
        <Field label="DVC 实验名">
          <Input name="dvcExpName" defaultValue={result?.dvcExpName ?? ""} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Git Commit">
          <Input name="gitCommit" defaultValue={result?.gitCommit ?? ""} />
        </Field>
        <Field label="Artifact 路径">
          <Input name="artifactPath" defaultValue={result?.artifactPath ?? ""} />
        </Field>
      </div>
      <Field label="备注">
        <Textarea name="notes" rows={3} defaultValue={result?.notes ?? ""} />
      </Field>
      <SubmitButton>{result ? "保存结果" : "记录结果"}</SubmitButton>
    </form>
  );
}
