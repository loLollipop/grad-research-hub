"use client";

import { useMemo, useState } from "react";
import type { Experiment, Paper, Project } from "@prisma/client";

import { Field } from "@/components/shared/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPERIMENT_TEMPLATES,
  experimentTemplateContent,
} from "@/lib/experiment-templates";
import { parseTags } from "@/lib/format";

export function ExperimentForm({
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
  const initialTemplate = experiment?.template ?? "purpose-method-result";
  const [template, setTemplate] = useState(initialTemplate);
  const [content, setContent] = useState(
    experiment?.content || experimentTemplateContent(initialTemplate),
  );
  const [dirty, setDirty] = useState(Boolean(experiment?.content));
  const selectedTemplate = useMemo(
    () => EXPERIMENT_TEMPLATES.find((item) => item.value === template),
    [template],
  );

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
            value={template}
            onChange={(event) => {
              const nextTemplate = event.target.value;
              setTemplate(nextTemplate);
              if (!dirty) {
                setContent(experimentTemplateContent(nextTemplate));
              }
            }}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            {EXPERIMENT_TEMPLATES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="soft-tile rounded-xl p-3 text-xs leading-5 text-muted-foreground">
        {selectedTemplate?.detail ?? "选择模板后会预填正文结构。"}
        {!experiment && dirty ? " 已手动编辑正文，切换模板不会再覆盖内容。" : null}
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
          value={content}
          onChange={(event) => {
            setDirty(true);
            setContent(event.target.value);
          }}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        记录正文保留 Markdown。模板只负责减少空白恐惧，不会限制你自由写。
      </p>
      <SubmitButton>{experiment ? "保存实验" : "创建实验"}</SubmitButton>
    </form>
  );
}
