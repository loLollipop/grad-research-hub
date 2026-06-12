"use client";

import { useState } from "react";
import type { Experiment, Paper, Project } from "@prisma/client";
import { BookOpenText, FlaskConical, FolderKanban, ListChecks } from "lucide-react";

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
  defaultTemplate,
  projects,
  papers,
  experiment,
}: {
  action: (formData: FormData) => Promise<void>;
  defaultTemplate?: string;
  projects: Project[];
  papers: Paper[];
  experiment?: Experiment & { papers?: Paper[] };
}) {
  const initialTemplate = experiment?.template ?? defaultTemplate ?? "purpose-method-result";
  const [template, setTemplate] = useState(initialTemplate);
  const [content, setContent] = useState(
    experiment?.content || experimentTemplateContent(initialTemplate),
  );
  const [dirty, setDirty] = useState(Boolean(experiment?.content));
  return (
    <form action={action} className="grid gap-4">
      {experiment ? <input type="hidden" name="id" value={experiment.id} /> : null}

      <section className="rounded-2xl border border-[#d8e7ea] bg-[linear-gradient(135deg,rgba(239,247,247,0.92),rgba(255,250,238,0.72))] p-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/82 text-primary shadow-sm">
            <FlaskConical className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <Field label="实验标题">
              <Input
                name="title"
                required
                defaultValue={experiment?.title ?? ""}
                placeholder="例如：复现第三组对照实验"
                className="h-10 bg-white/84 text-base font-medium"
              />
            </Field>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              像写实验纸一样先留下目的、观察、结论和下一步；参数细节放正文里即可。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border/70 bg-white/72 p-3 md:grid-cols-3">
        <CompactSelect
          icon={FolderKanban}
          label="项目"
          name="projectId"
          defaultValue={experiment?.projectId ?? ""}
          options={[
            { value: "", label: "不关联项目" },
            ...projects.map((project) => ({ value: project.id, label: project.title })),
          ]}
        />
        <CompactSelect
          icon={ListChecks}
          label="状态"
          name="status"
          defaultValue={experiment?.status ?? "running"}
          options={[
            { value: "running", label: "进行中" },
            { value: "completed", label: "完成" },
            { value: "failed", label: "失败" },
            { value: "abandoned", label: "放弃" },
          ]}
        />
        <div className="grid gap-1.5">
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FlaskConical className="size-3.5 text-primary" />
            模板
          </span>
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
            className="h-9 rounded-lg border bg-white/84 px-2 text-sm"
          >
            {EXPERIMENT_TEMPLATES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border/70 bg-white/72 p-3 md:grid-cols-2">
        <CompactSelect
          icon={BookOpenText}
          label="关联论文"
          name="paperId"
          defaultValue={experiment?.papers?.[0]?.id ?? ""}
          options={[
            { value: "", label: "不关联论文" },
            ...papers.map((paper) => ({ value: paper.id, label: paper.title })),
          ]}
        />
        <Field label="标签">
          <Input
            name="tags"
            defaultValue={parseTags(experiment?.tags).join(", ")}
            placeholder="例如：复现, 对照, 失败案例"
            className="h-9 bg-white/84"
          />
        </Field>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/72 bg-white/82">
        <div className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(240,247,247,0.9),rgba(255,250,238,0.68))] px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#173042]">
            <FlaskConical className="size-4 text-primary" />
            实验记录纸
          </p>
        </div>
        <Textarea
          name="content"
          rows={16}
          value={content}
          onChange={(event) => {
            setDirty(true);
            setContent(event.target.value);
          }}
          className="min-h-[26rem] resize-y rounded-none border-0 bg-white/68 p-4 font-mono text-sm leading-6 shadow-none focus-visible:ring-0"
        />
      </section>

      <div className="flex justify-end rounded-2xl border border-border/70 bg-white/72 p-3">
        <SubmitButton>{experiment ? "保存实验日志" : "保存到实验日志"}</SubmitButton>
      </div>
    </form>
  );
}

function CompactSelect({
  icon: Icon,
  label,
  name,
  defaultValue,
  options,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-9 rounded-lg border bg-white/84 px-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value || "empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
