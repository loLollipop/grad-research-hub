"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  AdminItem,
  Dataset,
  Experiment,
  Milestone,
  Paper,
  Project,
  Result,
  Task,
} from "@prisma/client";

import { checkAiConnection } from "@/lib/ai";
import { accessSettingsSchema, zoteroSettingsSchema } from "@/lib/config-validators";
import { prisma } from "@/lib/db";
import { splitTags, tagsToString } from "@/lib/format";
import { getMeetingBriefPeriod, type MeetingBriefScope } from "@/lib/meeting-brief";
import {
  adminItemSchema,
  aiSettingsSchema,
  datasetSchema,
  experimentSchema,
  milestoneSchema,
  noteSchema,
  paperSchema,
  projectSchema,
  resultSchema,
  taskSchema,
} from "@/lib/validators";
import {
  saveAccessPassword,
  saveAiSettings,
  saveZoteroSettings,
  getAiRuntimeConfig,
  getZoteroRuntimeConfig,
  verifyAccessPasswordInput,
} from "@/lib/settings";
import { checkZoteroConnection, fetchZoteroPapers } from "@/lib/zotero";

function data(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function fail(error: unknown): never {
  if (error instanceof Error) {
    throw new Error(error.message);
  }

  throw new Error("Form submission failed. Please check your input.");
}

function parseJsonText(value: string, fallback: string) {
  if (!value.trim()) {
    return fallback;
  }

  try {
    JSON.parse(value);
    return value;
  } catch {
    throw new Error("Invalid JSON field.");
  }
}

function parseJsonObject(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function resultFormData(formData: FormData) {
  return {
    ...data(formData),
    metrics: resultMetricsJson(formData),
    config: resultConfigJson(formData),
  };
}

function resultMetricsJson(formData: FormData) {
  const names = formData.getAll("metricName");
  const values = formData.getAll("metricValue");
  const metrics: Record<string, number | string> = {};

  names.forEach((rawName, index) => {
    const name = typeof rawName === "string" ? rawName.trim() : "";
    const rawValue = values[index];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!name || !value) return;

    const numericValue = Number(value);
    metrics[name] = Number.isFinite(numericValue) ? numericValue : value;
  });

  if (Object.keys(metrics).length) {
    return JSON.stringify(metrics);
  }

  const existing = formData.get("metrics");
  return typeof existing === "string" && existing.trim() ? existing : "{}";
}

function resultConfigJson(formData: FormData) {
  const existing = parseJsonObject(formData.get("config"));
  const reproducibility = String(formData.get("reproducibility") ?? "unknown");
  const allowed = ["unknown", "todo", "reproducing", "verified"];

  return JSON.stringify({
    ...existing,
    reproducibility: allowed.includes(reproducibility) ? reproducibility : "unknown",
    manuscriptReady: formData.get("manuscriptReady") === "true",
  });
}

export async function createPaper(formData: FormData) {
  const parsed = paperSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  const value = parsed.data;
  await prisma.paper.create({
    data: {
      title: value.title,
      authors: tagsToString(splitTags(formData.get("authors"))),
      year: value.year,
      abstract: value.abstract,
      journal: value.journal,
      doi: value.doi,
      arxivId: value.arxivId,
      zoteroKey: value.zoteroKey,
      bibtexKey: value.bibtexKey,
      category: value.category,
      readStatus: value.readStatus,
      pdfUrl: value.pdfUrl,
      externalUrl: value.externalUrl,
      notes: value.notes,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/papers");
}

export async function deletePaper(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.paper.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/papers");
}

export async function updatePaper(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parsed = paperSchema.safeParse(data(formData));
  if (!id) return;
  if (!parsed.success) fail(parsed.error);

  const value = parsed.data;
  await prisma.paper.update({
    where: { id },
    data: {
      title: value.title,
      authors: tagsToString(splitTags(formData.get("authors"))),
      year: value.year,
      abstract: value.abstract,
      journal: value.journal,
      doi: value.doi,
      arxivId: value.arxivId,
      zoteroKey: value.zoteroKey,
      bibtexKey: value.bibtexKey,
      category: value.category,
      readStatus: value.readStatus,
      pdfUrl: value.pdfUrl,
      externalUrl: value.externalUrl,
      notes: value.notes,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/papers");
}

export async function updatePaperStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const readStatus = String(formData.get("readStatus") ?? "unread");
  if (!id || !["unread", "reading", "read"].includes(readStatus)) return;

  await prisma.paper.update({ where: { id }, data: { readStatus } });
  revalidatePath("/");
  revalidatePath("/papers");
}

export async function updatePaperStatuses(formData: FormData) {
  const ids = formData
    .getAll("ids")
    .map((id) => String(id))
    .filter(Boolean);
  const readStatus = String(formData.get("readStatus") ?? "unread");
  const returnTo = safePapersReturnTo(String(formData.get("returnTo") ?? "/papers"));

  if (!ids.length || !["unread", "reading", "read"].includes(readStatus)) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}bulk=empty`);
  }

  await prisma.paper.updateMany({
    where: { id: { in: ids } },
    data: { readStatus },
  });
  revalidatePath("/");
  revalidatePath("/papers");
  redirect(
    `${returnTo}${returnTo.includes("?") ? "&" : "?"}bulk=success&count=${ids.length}&bulkStatus=${readStatus}`,
  );
}

export async function syncZoteroPapers() {
  let papers;

  try {
    papers = await fetchZoteroPapers();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zotero 同步失败。";
    redirect(`/papers?sync=error&message=${encodeURIComponent(message)}`);
  }

  await Promise.all(
    papers.map((paper) =>
      prisma.paper.upsert({
        where: { zoteroKey: paper.zoteroKey },
        create: {
          ...paper,
          readStatus: "unread",
        },
        update: {
          title: paper.title,
          authors: paper.authors,
          year: paper.year,
          abstract: paper.abstract,
          journal: paper.journal,
          doi: paper.doi,
          arxivId: paper.arxivId,
          category: paper.category,
          externalUrl: paper.externalUrl,
          tags: paper.tags,
          lastSyncedAt: paper.lastSyncedAt,
        },
      }),
    ),
  );

  revalidatePath("/");
  revalidatePath("/papers");
  revalidatePath("/settings");
  redirect(`/papers?sync=success&count=${papers.length}`);
}

function safePapersReturnTo(value: string) {
  return value.startsWith("/papers") ? value : "/papers";
}

function safeProjectsReturnTo(value: string) {
  return value.startsWith("/projects") ? value : "/projects";
}

export async function createProject(formData: FormData) {
  const parsed = projectSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  await prisma.project.create({
    data: {
      ...parsed.data,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
}

export async function updateProject(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parsed = projectSchema.safeParse(data(formData));
  if (!id) return;
  if (!parsed.success) fail(parsed.error);

  await prisma.project.update({
    where: { id },
    data: {
      ...parsed.data,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.project.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/experiments");
}

export async function createMilestone(formData: FormData) {
  const parsed = milestoneSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  await prisma.milestone.create({ data: parsed.data });
  revalidatePath("/");
  revalidatePath("/projects");
}

export async function updateMilestone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parsed = milestoneSchema.safeParse(data(formData));
  if (!id) return;
  if (!parsed.success) fail(parsed.error);

  await prisma.milestone.update({ where: { id }, data: parsed.data });
  revalidatePath("/");
  revalidatePath("/projects");
}

export async function deleteMilestone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.milestone.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/projects");
}

export async function createTask(formData: FormData) {
  const parsed = taskSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  const { milestoneId, ...value } = parsed.data;
  await prisma.task.create({
    data: {
      ...value,
      milestoneId,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
}

export async function updateTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parsed = taskSchema.safeParse(data(formData));
  if (!id) return;
  if (!parsed.success) fail(parsed.error);

  const { milestoneId, ...value } = parsed.data;
  await prisma.task.update({
    where: { id },
    data: {
      ...value,
      milestoneId: milestoneId ?? null,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
}

export async function deleteTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.task.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/projects");
}

export async function setTaskStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "todo");
  if (!id || !["todo", "doing", "done"].includes(status)) return;

  await prisma.task.update({ where: { id }, data: { status } });
  revalidatePath("/");
  revalidatePath("/projects");
}

export async function updateTaskStatuses(formData: FormData) {
  const ids = formData
    .getAll("ids")
    .map((id) => String(id))
    .filter(Boolean);
  const status = String(formData.get("status") ?? "done");
  const returnTo = safeProjectsReturnTo(String(formData.get("returnTo") ?? "/projects"));

  if (!ids.length || !["todo", "doing", "done"].includes(status)) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}taskBulk=empty`);
  }

  await prisma.task.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect(
    `${returnTo}${returnTo.includes("?") ? "&" : "?"}taskBulk=success&taskBulkCount=${ids.length}&taskBulkStatus=${status}`,
  );
}

export async function createExperimentFromTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { milestone: { include: { project: true } } },
  });

  if (!task) return;

  const projectId = task.milestone?.projectId ?? null;
  await prisma.$transaction([
    prisma.experiment.create({
      data: {
        title: `实验：${task.title}`,
        projectId,
        status: "running",
        template: "purpose-method-result",
        content: taskExperimentContent(task),
        tags: tagsToString(["任务转实验", "项目推进"]),
      },
    }),
    ...(task.status === "done"
      ? []
      : [
          prisma.task.update({
            where: { id: task.id },
            data: { status: "doing" },
          }),
        ]),
  ]);

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/experiments");

  const target = projectId
    ? `/experiments?project=${projectId}&status=running`
    : "/experiments?status=running";
  redirect(target);
}

function taskExperimentContent(
  task: Task & { milestone: (Milestone & { project: Project }) | null },
) {
  const context = task.description?.trim() || "- 待补充实验方法、数据或对照条件。";
  const source = task.milestone
    ? `${task.milestone.project.title} / ${task.milestone.title}`
    : "独立任务";

  return [
    "## 目的",
    `从项目任务推进：${task.title}`,
    "",
    "## 方法 / 参数",
    context,
    "",
    "## 观察",
    "",
    "## 结论 / 下一步",
    "",
    "---",
    `来源任务：${task.title}`,
    `归属：${source}`,
    `任务截止：${task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "未设置"}`,
  ].join("\n");
}

export async function createExperiment(formData: FormData) {
  const parsed = experimentSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  const { paperId, ...value } = parsed.data;
  await prisma.experiment.create({
    data: {
      ...value,
      tags: tagsToString(splitTags(formData.get("tags"))),
      papers: paperId ? { connect: [{ id: paperId }] } : undefined,
    },
  });

  revalidatePath("/");
  revalidatePath("/experiments");
}

export async function updateExperiment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parsed = experimentSchema.safeParse(data(formData));
  if (!id) return;
  if (!parsed.success) fail(parsed.error);

  const { paperId, projectId, ...value } = parsed.data;
  await prisma.experiment.update({
    where: { id },
    data: {
      ...value,
      projectId: projectId ?? null,
      tags: tagsToString(splitTags(formData.get("tags"))),
      papers: { set: paperId ? [{ id: paperId }] : [] },
    },
  });

  revalidatePath("/");
  revalidatePath("/experiments");
}

export async function deleteExperiment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.experiment.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/experiments");
}

export async function setExperimentStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "running");
  if (!id || !["running", "completed", "failed", "abandoned"].includes(status)) {
    return;
  }

  await prisma.experiment.update({ where: { id }, data: { status } });
  revalidatePath("/");
  revalidatePath("/experiments");
}

export async function createExperimentReviewTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const experiment = await prisma.experiment.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          milestones: {
            orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
            take: 1,
          },
        },
      },
    },
  });

  if (!experiment) return;

  const milestoneId = experiment.project?.milestones[0]?.id;
  await prisma.task.create({
    data: {
      title: `复盘失败实验：${experiment.title}`,
      description: [
        "从失败实验中提取下一步：",
        "",
        "- 失败现象：",
        "- 可能原因：",
        "- 需要补做的对照：",
        "- 下一次实验修改：",
      ].join("\n"),
      priority: "high",
      status: "todo",
      tags: tagsToString(["实验复盘", "失败案例"]),
      milestoneId,
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/experiments");
  redirect("/projects");
}

export async function createNote(formData: FormData) {
  const parsed = noteSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  const note = await prisma.note.create({
    data: {
      ...parsed.data,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

export async function updateNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parsed = noteSchema.safeParse(data(formData));
  if (!id) return;
  if (!parsed.success) fail(parsed.error);

  await prisma.note.update({
    where: { id },
    data: {
      ...parsed.data,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/notes");
}

export async function deleteNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.note.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/notes");
  redirect("/notes");
}

export async function createTasksFromNoteChecklist(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) return;

  const checklistItems = extractOpenChecklistItems(note.content).filter(
    (item) => !note.content.includes(noteTaskMarker(note.id, item.key)),
  );

  if (!checklistItems.length) {
    redirect(`/notes?note=${note.id}&taskSync=empty`);
  }

  await prisma.$transaction([
    ...checklistItems.map((item) =>
      prisma.task.create({
        data: {
          title: item.title,
          description: [
            `来自笔记：${note.title}`,
            "",
            `原始清单：${item.raw}`,
            "",
            "后续可在项目页挂到对应里程碑。",
          ].join("\n"),
          priority: item.title.includes("导师") || item.title.includes("实验") ? "high" : "medium",
          status: "todo",
          tags: tagsToString(["笔记清单", note.folder]),
        },
      }),
    ),
    prisma.note.update({
      where: { id: note.id },
      data: {
        content: [
          note.content.trimEnd(),
          "",
          "<!-- task-sync:start -->",
          ...checklistItems.map((item) => noteTaskMarker(note.id, item.key)),
          "<!-- task-sync:end -->",
        ].join("\n"),
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath("/projects");
  redirect(`/projects?status=todo&taskSync=success&taskSyncCount=${checklistItems.length}`);
}

export async function quickCapture(formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;

  await prisma.note.create({
    data: {
      title: content.slice(0, 28),
      content,
      folder: "Inbox",
      tags: tagsToString(["quick-capture"]),
    },
  });

  revalidatePath("/");
  revalidatePath("/notes");
}

function extractOpenChecklistItems(content: string) {
  return content
    .split("\n")
    .map((line) => {
      const match = line.match(/^\s*[-*]\s+\[\s\]\s+(.+?)\s*$/);
      if (!match?.[1]) return null;
      const title = match[1]
        .replace(/\[\[([^\]]+)\]\]/g, "$1")
        .replace(/[*_`]/g, "")
        .trim();

      if (!title) return null;

      return {
        key: stableTaskKey(title),
        raw: line.trim(),
        title: title.length > 80 ? `${title.slice(0, 80)}...` : title,
      };
    })
    .filter((item): item is { key: string; raw: string; title: string } => Boolean(item))
    .slice(0, 20);
}

function stableTaskKey(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function noteTaskMarker(noteId: string, key: string) {
  return `<!-- note-task:${noteId}:${key} -->`;
}

export async function createMeetingBriefNote(formData: FormData) {
  const rawScope = String(formData.get("scope") ?? "week");
  const scope: MeetingBriefScope = rawScope === "today" ? "today" : "week";
  const now = new Date();
  const period = getMeetingBriefPeriod(now, scope);

  const existingNote = await prisma.note.findFirst({
    where: {
      folder: "组会",
      content: { contains: period.marker, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existingNote) {
    redirect(`/notes?note=${existingNote.id}`);
  }

  const [tasks, adminItems, experiments, results, papers] = await Promise.all([
    prisma.task.findMany({
      where: {
        status: { not: "done" },
        OR: [{ priority: "high" }, { dueDate: { lt: period.endExclusive } }],
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 10,
      include: { milestone: { include: { project: true } } },
    }),
    prisma.adminItem.findMany({
      where: {
        status: { not: "done" },
        OR: [{ dueDate: { lt: period.endExclusive } }, { type: "meeting" }],
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.experiment.findMany({
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { project: true, results: true },
    }),
    prisma.result.findMany({
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { dataset: true, experiment: { include: { project: true } } },
    }),
    prisma.paper.findMany({
      where: { readStatus: { in: ["unread", "reading"] } },
      orderBy: [{ readStatus: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
  ]);

  const note = await prisma.note.create({
    data: {
      title: period.title,
      folder: "组会",
      content: meetingBriefMarkdown({
        generatedAt: now,
        period,
        tasks,
        adminItems,
        experiments,
        results,
        papers,
      }),
      tags: tagsToString(["组会", "周报", "自动整理"]),
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

export async function createDataset(formData: FormData) {
  const parsed = datasetSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  await prisma.dataset.create({
    data: {
      ...parsed.data,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/data");
}

export async function updateDataset(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parsed = datasetSchema.safeParse(data(formData));
  if (!id) return;
  if (!parsed.success) fail(parsed.error);

  await prisma.dataset.update({
    where: { id },
    data: {
      ...parsed.data,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/data");
}

export async function deleteDataset(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.dataset.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/data");
}

export async function createResult(formData: FormData) {
  const parsed = resultSchema.safeParse(resultFormData(formData));
  if (!parsed.success) fail(parsed.error);

  const { metrics, config, ...value } = parsed.data;
  await prisma.result.create({
    data: {
      ...value,
      metrics: parseJsonText(metrics, "{}"),
      config: parseJsonText(config, "{}"),
    },
  });

  revalidatePath("/");
  revalidatePath("/data");
}

export async function updateResult(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parsed = resultSchema.safeParse(resultFormData(formData));
  if (!id) return;
  if (!parsed.success) fail(parsed.error);

  const { metrics, config, ...value } = parsed.data;
  await prisma.result.update({
    where: { id },
    data: {
      ...value,
      metrics: parseJsonText(metrics, "{}"),
      config: parseJsonText(config, "{}"),
    },
  });

  revalidatePath("/");
  revalidatePath("/data");
}

export async function deleteResult(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.result.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/data");
}

export async function createResultBriefNote(formData: FormData) {
  const ids = formData
    .getAll("ids")
    .map((id) => String(id))
    .filter(Boolean)
    .slice(0, 30);

  if (!ids.length) {
    redirect("/data?brief=empty");
  }

  const results = await prisma.result.findMany({
    where: { id: { in: ids } },
    orderBy: { updatedAt: "desc" },
    include: { experiment: true, dataset: true },
  });

  if (!results.length) {
    redirect("/data?brief=empty");
  }

  const note = await prisma.note.create({
    data: {
      title: `组会/论文图表清单 ${new Date().toISOString().slice(0, 10)}`,
      folder: "组会",
      content: resultBriefMarkdown(results),
      tags: tagsToString(["成果清单", "组会", "论文素材"]),
    },
  });

  revalidatePath("/");
  revalidatePath("/data");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

export async function createTaskFromResult(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const result = await prisma.result.findUnique({
    where: { id },
    include: {
      dataset: true,
      experiment: {
        include: {
          project: {
            include: {
              milestones: {
                orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!result) return;

  const milestoneId = result.experiment?.project?.milestones[0]?.id;
  await prisma.task.create({
    data: {
      title: `补证据：${result.title}`,
      description: resultTaskDescription(result),
      priority: "high",
      status: "todo",
      tags: tagsToString(["结果证据", "待补"]),
      milestoneId,
    },
  });

  revalidatePath("/");
  revalidatePath("/data");
  revalidatePath("/projects");
  redirect("/projects?priority=high&status=todo");
}

export async function appendResultToExperiment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const result = await prisma.result.findUnique({
    where: { id },
    include: {
      dataset: true,
      experiment: true,
    },
  });

  if (!result?.experiment) return;

  const marker = `<!-- result:${result.id} -->`;
  if (result.experiment.content.includes(marker)) {
    redirect(experimentResultTarget(result.experiment.projectId, result.experiment.status));
  }

  await prisma.experiment.update({
    where: { id: result.experiment.id },
    data: {
      content: [result.experiment.content.trim(), resultExperimentSection(result, marker)]
        .filter(Boolean)
        .join("\n\n"),
      status: result.experiment.status === "running" ? "completed" : result.experiment.status,
    },
  });

  revalidatePath("/");
  revalidatePath("/experiments");
  revalidatePath("/data");

  redirect(
    experimentResultTarget(
      result.experiment.projectId,
      result.experiment.status === "running" ? "completed" : result.experiment.status,
    ),
  );
}

function resultBriefMarkdown(
  results: Array<{
    title: string;
    metrics: string;
    config: string;
    artifactPath: string | null;
    notes: string | null;
    updatedAt: Date;
    experiment: { title: string } | null;
    dataset: { name: string } | null;
  }>,
) {
  const lines = [
    "# 组会/论文图表清单",
    "",
    `生成时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    `结果数量：${results.length}`,
    "",
    "## 本次可讲的结论",
    "",
  ];

  results.forEach((result, index) => {
    const config = parseJsonObjectText(result.config);
    const metrics = parseJsonObjectText(result.metrics);
    const metricText = Object.entries(metrics)
      .filter(([, value]) => String(value).trim())
      .slice(0, 6)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("；") || "未填写核心指标";
    const reproducibility = reproducibilityText(String(config.reproducibility ?? "unknown"));
    const manuscriptReady = config.manuscriptReady ? "是" : result.artifactPath ? "有图表路径" : "否";

    lines.push(
      `### ${index + 1}. ${result.title}`,
      "",
      `- 关联实验：${result.experiment?.title ?? "未关联"}`,
      `- 数据集：${result.dataset?.name ?? "未关联"}`,
      `- 核心指标：${metricText}`,
      `- 复现状态：${reproducibility}`,
      `- 可写入论文/组会：${manuscriptReady}`,
      `- 图表或结果文件：${result.artifactPath || "待补"}`,
      `- 最近更新：${result.updatedAt.toISOString().slice(0, 10)}`,
      `- 一句话结论：${result.notes?.trim() || "待补充"}`,
      "",
    );
  });

  lines.push(
    "## 汇报前检查",
    "",
    "- [ ] 每个结果都有一句话结论",
    "- [ ] 关键图表路径可以打开",
    "- [ ] 已标出哪些结果完成复现",
    "- [ ] 待补实验或对照已经变成下一步任务",
  );

  return lines.join("\n");
}

type MeetingBriefTask = Task & {
  milestone: (Milestone & { project: Project }) | null;
};

type MeetingBriefExperiment = Experiment & {
  project: Project | null;
  results: Result[];
};

type MeetingBriefResult = Result & {
  dataset: Dataset | null;
  experiment: (Experiment & { project: Project | null }) | null;
};

function meetingBriefMarkdown({
  generatedAt,
  period,
  tasks,
  adminItems,
  experiments,
  results,
  papers,
}: {
  generatedAt: Date;
  period: ReturnType<typeof getMeetingBriefPeriod>;
  tasks: MeetingBriefTask[];
  adminItems: AdminItem[];
  experiments: MeetingBriefExperiment[];
  results: MeetingBriefResult[];
  papers: Paper[];
}) {
  const lines = [
    period.marker,
    "",
    `# ${period.title}`,
    "",
    `生成时间：${generatedAt.toLocaleString("zh-CN", { hour12: false })}`,
    `覆盖范围：${period.shortLabel}`,
    "",
    "> 自动整理自研途 Hub。先改“本周最需要讲清楚”的三行，再补细节。",
    "",
    "## 本周最需要讲清楚",
    "",
    "- [ ] 核心进展：",
    "- [ ] 最大阻塞：",
    "- [ ] 下周计划：",
    "",
    "## 下一步任务",
    "",
  ];

  if (tasks.length) {
    tasks.forEach((task, index) => {
      const owner = task.milestone
        ? `${task.milestone.project.title} / ${task.milestone.title}`
        : "独立任务";
      lines.push(
        `${index + 1}. ${task.title}`,
        `   - 归属：${owner}`,
        `   - 优先级：${taskPriorityText(task.priority)}；状态：${taskStatusText(task.status)}；截止：${dateText(task.dueDate)}`,
        task.description?.trim() ? `   - 备注：${oneLine(task.description, 120)}` : "",
      );
    });
  } else {
    lines.push("- 暂无本周高优先级或临近截止任务。");
  }

  lines.push("", "## 实验进展", "");

  if (experiments.length) {
    experiments.forEach((experiment) => {
      lines.push(
        `- ${experiment.title}`,
        `  - 项目：${experiment.project?.title ?? "未关联项目"}；状态：${experimentStatusText(experiment.status)}；结果数：${experiment.results.length}`,
        `  - 最近更新：${dateText(experiment.updatedAt)}`,
        `  - 摘要：${experimentSnippet(experiment.content)}`,
      );
    });
  } else {
    lines.push("- 暂无实验记录。");
  }

  lines.push("", "## 结果证据", "");

  if (results.length) {
    results.forEach((result) => {
      const config = parseJsonObjectText(result.config);
      const metrics = parseJsonObjectText(result.metrics);
      const metricText = Object.entries(metrics)
        .filter(([, value]) => String(value).trim())
        .slice(0, 5)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join("；") || "未填写核心指标";
      const manuscriptReady = config.manuscriptReady ? "是" : result.artifactPath ? "有图表路径" : "否";

      lines.push(
        `- ${result.title}`,
        `  - 项目：${result.experiment?.project?.title ?? "未关联项目"}；实验：${result.experiment?.title ?? "未关联实验"}`,
        `  - 数据集：${result.dataset?.name ?? "未关联数据集"}`,
        `  - 指标：${metricText}`,
        `  - 复现：${reproducibilityText(String(config.reproducibility ?? "unknown"))}；可写入论文/组会：${manuscriptReady}`,
        `  - 结论：${result.notes?.trim() || "待补充"}`,
      );
    });
  } else {
    lines.push("- 暂无结果证据。");
  }

  lines.push("", "## 文献阅读", "");

  if (papers.length) {
    papers.forEach((paper) => {
      lines.push(
        `- [${paperStatusText(paper.readStatus)}] ${paper.title}`,
        `  - 来源：${paper.journal || paper.category || "未填写"}；年份：${paper.year ?? "未知"}`,
        paper.notes?.trim() ? `  - 笔记：${oneLine(paper.notes, 120)}` : "",
      );
    });
  } else {
    lines.push("- 暂无待读或读中文献。");
  }

  lines.push("", "## 事务提醒", "");

  if (adminItems.length) {
    adminItems.forEach((item) => {
      lines.push(
        `- ${item.title}`,
        `  - 类型：${adminTypeText(item.type)}；状态：${taskStatusText(item.status)}；截止：${dateText(item.dueDate)}`,
        item.location ? `  - 地点 / 渠道：${item.location}` : "",
        item.notes?.trim() ? `  - 备注：${oneLine(item.notes, 120)}` : "",
      );
    });
  } else {
    lines.push("- 暂无临近事务。");
  }

  lines.push(
    "",
    "## 会后回填",
    "",
    "- [ ] 把导师反馈拆成项目任务",
    "- [ ] 把需要补实验的结果转成待补任务",
    "- [ ] 把新的阅读建议同步到 Zotero 或文献台",
    "- [ ] 把本次会议结论写回相关实验/结果/笔记",
  );

  return lines.join("\n");
}

function dateText(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "未设置";
}

function oneLine(value: string, limit: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function experimentSnippet(content: string) {
  const firstUsefulLine = content
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
    .find((line) => line && !["目的", "方法 / 参数", "观察", "结论 / 下一步"].includes(line));

  return firstUsefulLine ? oneLine(firstUsefulLine, 120) : "待补充摘要。";
}

function taskPriorityText(value: string) {
  const labels: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };

  return labels[value] ?? value;
}

function taskStatusText(value: string) {
  const labels: Record<string, string> = {
    todo: "待办",
    doing: "进行中",
    done: "完成",
  };

  return labels[value] ?? value;
}

function experimentStatusText(value: string) {
  const labels: Record<string, string> = {
    running: "进行中",
    completed: "已完成",
    failed: "失败",
    abandoned: "放弃",
  };

  return labels[value] ?? value;
}

function paperStatusText(value: string) {
  const labels: Record<string, string> = {
    unread: "待读",
    reading: "读中",
    read: "已读",
  };

  return labels[value] ?? value;
}

function adminTypeText(value: string) {
  const labels: Record<string, string> = {
    meeting: "组会",
    material: "材料",
    reimbursement: "报销",
    deadline: "截止",
  };

  return labels[value] ?? value;
}

function resultTaskDescription(result: {
  title: string;
  metrics: string;
  config: string;
  artifactPath: string | null;
  notes: string | null;
  updatedAt: Date;
  experiment: {
    title: string;
    project: { title: string } | null;
  } | null;
  dataset: { name: string } | null;
}) {
  const config = parseJsonObjectText(result.config);
  const metrics = parseJsonObjectText(result.metrics);
  const metricText = Object.entries(metrics)
    .filter(([, value]) => String(value).trim())
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("；") || "未填写核心指标";
  const reproducibility = reproducibilityText(String(config.reproducibility ?? "unknown"));
  const manuscriptReady = config.manuscriptReady ? "是" : result.artifactPath ? "有图表路径" : "否";

  return [
    "从结果证据台生成的待补任务：",
    "",
    `- 结果：${result.title}`,
    `- 项目：${result.experiment?.project?.title ?? "未关联项目"}`,
    `- 实验：${result.experiment?.title ?? "未关联实验"}`,
    `- 数据集：${result.dataset?.name ?? "未关联数据集"}`,
    `- 核心指标：${metricText}`,
    `- 复现状态：${reproducibility}`,
    `- 可写入论文/组会：${manuscriptReady}`,
    `- 图表或结果文件：${result.artifactPath || "待补"}`,
    `- 一句话结论：${result.notes?.trim() || "待补充"}`,
    `- 最近更新：${result.updatedAt.toISOString().slice(0, 10)}`,
    "",
    "下一步检查：",
    "- [ ] 补齐复现实验或对照",
    "- [ ] 确认图表路径和结果文件可打开",
    "- [ ] 把结论写成一两句话，供组会/论文使用",
  ].join("\n");
}

function resultExperimentSection(
  result: {
    id: string;
    title: string;
    metrics: string;
    config: string;
    artifactPath: string | null;
    notes: string | null;
    updatedAt: Date;
    dataset: { name: string } | null;
  },
  marker: string,
) {
  const config = parseJsonObjectText(result.config);
  const metrics = parseJsonObjectText(result.metrics);
  const metricText = Object.entries(metrics)
    .filter(([, value]) => String(value).trim())
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("；") || "未填写核心指标";

  return [
    marker,
    "## 结果回填",
    "",
    `- 结果：${result.title}`,
    `- 数据集：${result.dataset?.name ?? "未关联数据集"}`,
    `- 核心指标：${metricText}`,
    `- 复现状态：${reproducibilityText(String(config.reproducibility ?? "unknown"))}`,
    `- 图表或结果文件：${result.artifactPath || "待补"}`,
    `- 更新时间：${result.updatedAt.toISOString().slice(0, 10)}`,
    `- 结论 / 下一步：${result.notes?.trim() || "待补充"}`,
  ].join("\n");
}

function experimentResultTarget(projectId: string | null, status: string) {
  const params = new URLSearchParams();
  if (projectId) params.set("project", projectId);
  if (status) params.set("status", status);
  const query = params.toString();
  return query ? `/experiments?${query}` : "/experiments";
}

function parseJsonObjectText(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function reproducibilityText(value: string) {
  const labels: Record<string, string> = {
    unknown: "待判断",
    todo: "待复现",
    reproducing: "复现中",
    verified: "已复现",
  };

  return labels[value] ?? value;
}

export async function createAdminItem(formData: FormData) {
  const parsed = adminItemSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  await prisma.adminItem.create({
    data: {
      ...parsed.data,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function updateAdminItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parsed = adminItemSchema.safeParse(data(formData));
  if (!id) return;
  if (!parsed.success) fail(parsed.error);

  await prisma.adminItem.update({
    where: { id },
    data: {
      ...parsed.data,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function setAdminStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "todo");
  if (!id || !["todo", "doing", "done"].includes(status)) return;

  await prisma.adminItem.update({ where: { id }, data: { status } });
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function deleteAdminItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.adminItem.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function updateAiSettings(formData: FormData) {
  const parsed = aiSettingsSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  await saveAiSettings(parsed.data);
  revalidatePath("/settings");
  revalidatePath("/ai");
}

export async function testAiSettings(formData: FormData) {
  const parsed = aiSettingsSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  const current = await getAiRuntimeConfig();
  const value = parsed.data;
  const result = await checkAiConnection({
    provider: value.provider,
    apiKey: value.apiKey || current.apiKey,
    baseUrl: value.baseUrl,
    model: value.model,
  });

  redirect(settingsFeedbackUrl("ai", result.status, result.message));
}

export async function updateAccessSettings(formData: FormData) {
  const parsed = accessSettingsSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  const valid = await verifyAccessPasswordInput(parsed.data.currentPassword);
  if (!valid) {
    throw new Error("Current password is incorrect.");
  }

  await saveAccessPassword(parsed.data.newPassword);
  revalidatePath("/settings");
}

export async function updateZoteroSettings(formData: FormData) {
  const parsed = zoteroSettingsSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  await saveZoteroSettings(parsed.data);
  revalidatePath("/settings");
  revalidatePath("/papers");
}

export async function testZoteroSettings(formData: FormData) {
  const parsed = zoteroSettingsSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  const current = await getZoteroRuntimeConfig();
  const value = parsed.data;
  const result = await checkZoteroConnection({
    apiKey: value.apiKey || current.apiKey,
    libraryId: value.libraryId,
    libraryType: value.libraryType,
    collectionKey: value.collectionKey,
    syncLimit: value.syncLimit,
  });

  redirect(settingsFeedbackUrl("zotero", result.ok ? "success" : "error", result.message));
}

function settingsFeedbackUrl(section: string, status: string, message: string) {
  const params = new URLSearchParams({
    section,
    status,
    message,
  });

  return `/settings?${params.toString()}`;
}
