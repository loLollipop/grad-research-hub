import { FlaskConical, Plus, Trash2 } from "lucide-react";
import type { Experiment, Paper, Project } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  createExperiment,
  deleteExperiment,
  setExperimentStatus,
  updateExperiment,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDateTime, parseTags } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

export default async function ExperimentsPage() {
  const [experiments, projects, papers] = await Promise.all([
    prisma.experiment.findMany({
      orderBy: { updatedAt: "desc" },
      include: { project: true, papers: true, results: true },
    }),
    prisma.project.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.paper.findMany({ orderBy: { updatedAt: "desc" } }),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="实验"
        title="实验记录"
        description="一次实验一条记录，重点保留目的、方法、结果和下一步，不把实验日志变成工具参数仓库。"
        actions={
          <details className="rounded-lg border bg-white/95 px-3 py-2">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Plus className="size-4" />
              新建实验
            </summary>
            <div className="mt-4 w-[min(760px,82vw)]">
              <ExperimentForm
                action={createExperiment}
                projects={projects}
                papers={papers}
              />
            </div>
          </details>
        }
      />

      <section className="grid gap-3">
        {experiments.length ? (
          experiments.map((experiment) => (
            <Card key={experiment.id} className="rounded-lg bg-white/95">
              <CardContent className="grid gap-3 py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{experiment.title}</h2>
                      <StatusBadge value={experiment.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {experiment.project?.title ?? "未关联项目"} · 更新{" "}
                      {formatDateTime(experiment.updatedAt)}
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
                    <Button type="submit" variant="outline">
                      更新
                    </Button>
                  </form>
                </div>

                <TagList value={experiment.tags} />
                <Tabs defaultValue="content" className="w-full">
                  <TabsList>
                    <TabsTrigger value="content">记录</TabsTrigger>
                    <TabsTrigger value="links">关联</TabsTrigger>
                    <TabsTrigger value="edit">编辑</TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="content"
                    className="rounded-lg border bg-[#fffdf7] p-4 text-sm leading-6"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {experiment.content || "暂无实验内容。"}
                    </ReactMarkdown>
                  </TabsContent>
                  <TabsContent value="links" className="rounded-lg border p-4 text-sm">
                    <div className="grid gap-2 text-muted-foreground">
                      <p>
                        关联论文：{" "}
                        {experiment.papers.map((paper) => paper.title).join("；") ||
                          "暂无"}
                      </p>
                      <p>已登记结果：{experiment.results.length} 条</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="edit" className="rounded-lg border p-4">
                    <ExperimentForm
                      action={updateExperiment}
                      projects={projects}
                      papers={papers}
                      experiment={experiment}
                    />
                    <form action={deleteExperiment} className="mt-3">
                      <input type="hidden" name="id" value={experiment.id} />
                      <Button type="submit" variant="destructive">
                        <Trash2 className="size-4" />
                        删除实验
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))
        ) : (
          <EmptyState
            icon={FlaskConical}
            title="暂无实验记录"
            description="先建立第一条实验记录，把目的、参数、观察和结论写下来。"
          />
        )}
      </section>
    </div>
  );
}

function ExperimentForm({
  action,
  projects,
  papers,
  experiment,
}: {
  action: (formData: FormData) => Promise<void>;
  projects: Project[];
  papers: Paper[];
  experiment?: Experiment & { papers?: Paper[] };
}) {
  return (
    <form action={action} className="grid gap-3">
      {experiment ? <input type="hidden" name="id" value={experiment.id} /> : null}
      <Field label="实验标题">
        <Input name="title" required defaultValue={experiment?.title ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="项目">
          <select
            name="projectId"
            defaultValue={experiment?.projectId ?? ""}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">不关联项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="状态">
          <select
            name="status"
            defaultValue={experiment?.status ?? "running"}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="running">进行中</option>
            <option value="completed">完成</option>
            <option value="failed">失败</option>
            <option value="abandoned">放弃</option>
          </select>
        </Field>
        <Field label="模板">
          <select
            name="template"
            defaultValue={experiment?.template ?? "purpose-method-result"}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="purpose-method-result">目的 / 方法 / 结果</option>
            <option value="ablation">消融实验</option>
            <option value="reproduction">复现实验</option>
            <option value="debug">问题排查</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="关联论文">
          <select
            name="paperId"
            defaultValue={experiment?.papers?.[0]?.id ?? ""}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="">不关联论文</option>
            {papers.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="标签">
          <Input name="tags" defaultValue={parseTags(experiment?.tags).join(", ")} />
        </Field>
      </div>
      <Field label="实验内容">
        <Textarea
          name="content"
          rows={14}
          defaultValue={
            experiment?.content ??
            "## 目的\n\n## 方法 / 参数\n\n## 结果\n\n## 结论 / 下一步\n"
          }
        />
      </Field>
      <SubmitButton>{experiment ? "保存实验" : "创建实验"}</SubmitButton>
    </form>
  );
}
