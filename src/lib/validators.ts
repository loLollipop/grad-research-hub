import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : undefined)),
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? new Date(value) : undefined))
    .refine((value) => value === undefined || !Number.isNaN(value.getTime()), {
      message: "日期格式不正确",
    }),
);

export const paperSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空"),
  authors: optionalText,
  year: z
    .string()
    .trim()
    .transform((value) => (value ? Number(value) : undefined))
    .refine(
      (value) =>
        value === undefined ||
        (Number.isInteger(value) && value >= 1900 && value <= 2100),
      "年份需要在 1900 到 2100 之间",
    ),
  journal: optionalText,
  doi: optionalText,
  arxivId: optionalText,
  zoteroKey: optionalText,
  bibtexKey: optionalText,
  category: z.string().trim().default("inbox"),
  readStatus: z.enum(["unread", "reading", "read"]).default("unread"),
  abstract: optionalText,
  pdfUrl: optionalText,
  externalUrl: optionalText,
  notes: optionalText,
});

export const projectSchema = z.object({
  title: z.string().trim().min(1, "项目名不能为空"),
  description: optionalText,
  status: z.enum(["active", "paused", "archived"]).default("active"),
});

export const milestoneSchema = z.object({
  projectId: z.string().min(1, "需要选择项目"),
  title: z.string().trim().min(1, "里程碑不能为空"),
  dueDate: optionalDate,
  status: z.enum(["planned", "running", "completed"]).default("planned"),
});

export const taskSchema = z.object({
  milestoneId: optionalText,
  title: z.string().trim().min(1, "任务不能为空"),
  description: optionalText,
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  status: z.enum(["todo", "doing", "done"]).default("todo"),
  dueDate: optionalDate,
});

export const experimentSchema = z.object({
  title: z.string().trim().min(1, "实验标题不能为空"),
  projectId: optionalText,
  status: z
    .enum(["running", "completed", "failed", "abandoned"])
    .default("running"),
  template: z.string().trim().default("standard"),
  content: z.string().default(""),
  externalRunId: optionalText,
  repositoryUrl: optionalText,
  gitCommit: optionalText,
  artifactPath: optionalText,
  paperId: optionalText,
});

export const noteSchema = z.object({
  title: z.string().trim().min(1, "笔记标题不能为空"),
  folder: z.string().trim().default("Inbox"),
  content: z.string().default(""),
});

export const datasetSchema = z.object({
  name: z.string().trim().min(1, "数据集名称不能为空"),
  source: optionalText,
  version: optionalText,
  path: optionalText,
  externalUrl: optionalText,
  dvcPath: optionalText,
  description: optionalText,
});

export const resultSchema = z.object({
  title: z.string().trim().min(1, "结果名称不能为空"),
  experimentId: optionalText,
  datasetId: optionalText,
  metrics: z.string().trim().default("{}"),
  config: z.string().trim().default("{}"),
  mlflowRunId: optionalText,
  dvcExpName: optionalText,
  gitCommit: optionalText,
  artifactPath: optionalText,
  notes: optionalText,
});

export const adminItemSchema = z.object({
  title: z.string().trim().min(1, "事务标题不能为空"),
  type: z
    .enum(["meeting", "material", "reimbursement", "deadline"])
    .default("meeting"),
  status: z.enum(["todo", "doing", "done"]).default("todo"),
  dueDate: optionalDate,
  location: optionalText,
  notes: optionalText,
});
