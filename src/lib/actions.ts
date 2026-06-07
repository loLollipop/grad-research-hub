"use server";

import { revalidatePath } from "next/cache";

import { accessSettingsSchema, zoteroSettingsSchema } from "@/lib/config-validators";
import { prisma } from "@/lib/db";
import { splitTags, tagsToString } from "@/lib/format";
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
  verifyAccessPasswordInput,
} from "@/lib/settings";
import { fetchZoteroPapers } from "@/lib/zotero";

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

export async function syncZoteroPapers() {
  const papers = await fetchZoteroPapers();

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

export async function createNote(formData: FormData) {
  const parsed = noteSchema.safeParse(data(formData));
  if (!parsed.success) fail(parsed.error);

  await prisma.note.create({
    data: {
      ...parsed.data,
      tags: tagsToString(splitTags(formData.get("tags"))),
    },
  });

  revalidatePath("/");
  revalidatePath("/notes");
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
