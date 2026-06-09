"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  AdminItem,
  Dataset,
  Experiment,
  Milestone,
  Note,
  Paper,
  Project,
  Result,
  Task,
} from "@prisma/client";

import { checkAiConnection } from "@/lib/ai";
import { accessSettingsSchema, zoteroSettingsSchema } from "@/lib/config-validators";
import { getDailyPlanPeriod } from "@/lib/daily-plan";
import { prisma } from "@/lib/db";
import { parseTags, splitTags, tagsToString } from "@/lib/format";
import { getMeetingBriefPeriod, type MeetingBriefScope } from "@/lib/meeting-brief";
import { getWritingPackPeriod } from "@/lib/writing-pack";
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

export async function createReadingNoteFromPaper(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const paper = await prisma.paper.findUnique({ where: { id } });
  if (!paper) return;

  const marker = paperNoteMarker(paper.id);
  const existing = await prisma.note.findFirst({
    where: { content: { contains: marker, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    redirect(`/notes?note=${existing.id}`);
  }

  const note = await prisma.note.create({
    data: {
      title: `阅读：${paper.title}`.slice(0, 80),
      folder: "文献",
      content: buildPaperReadingNote(paper),
      tags: tagsToString(["文献笔记", "quick-review", ...parseTags(paper.tags).slice(0, 4)]),
    },
  });

  if (paper.readStatus === "unread") {
    await prisma.paper.update({
      where: { id: paper.id },
      data: { readStatus: "reading" },
    });
  }

  revalidatePath("/");
  revalidatePath("/papers");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

export async function createExperimentFromPaper(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const paper = await prisma.paper.findUnique({ where: { id } });
  if (!paper) return;

  const marker = paperExperimentMarker(paper.id);
  const existing = await prisma.experiment.findFirst({
    where: { content: { contains: marker, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    redirect(`/experiments?q=${encodeURIComponent(paper.title)}`);
  }

  await prisma.$transaction([
    prisma.experiment.create({
      data: {
        title: `复现实验：${paper.title}`.slice(0, 90),
        status: "running",
        template: "reproduction",
        content: buildPaperExperimentDraft(paper, marker),
        tags: tagsToString(["文献转实验", "复现", ...parseTags(paper.tags).slice(0, 4)]),
        papers: { connect: [{ id: paper.id }] },
      },
    }),
    ...(paper.readStatus === "unread"
      ? [
          prisma.paper.update({
            where: { id: paper.id },
            data: { readStatus: "reading" },
          }),
        ]
      : []),
  ]);

  revalidatePath("/");
  revalidatePath("/papers");
  revalidatePath("/experiments");
  redirect(`/experiments?q=${encodeURIComponent(paper.title)}`);
}

export async function createTaskFromPaper(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const paper = await prisma.paper.findUnique({ where: { id } });
  if (!paper) return;

  const marker = paperTaskMarker(paper.id);
  const existing = await prisma.task.findFirst({
    where: { description: { contains: marker, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    redirect("/projects?focus=experiment");
  }

  await prisma.$transaction([
    prisma.task.create({
      data: {
        title: `验证文献想法：${paper.title}`.slice(0, 100),
        description: buildPaperTaskDescription(paper, marker),
        priority: "medium",
        status: "todo",
        tags: tagsToString(["文献任务", "待验证", ...parseTags(paper.tags).slice(0, 4)]),
      },
    }),
    ...(paper.readStatus === "unread"
      ? [
          prisma.paper.update({
            where: { id: paper.id },
            data: { readStatus: "reading" },
          }),
        ]
      : []),
  ]);

  revalidatePath("/");
  revalidatePath("/papers");
  revalidatePath("/projects");
  redirect("/projects?focus=experiment");
}

export async function createReadingPlanNote(formData: FormData) {
  const ids = formData
    .getAll("ids")
    .map((id) => String(id))
    .filter(Boolean)
    .slice(0, 12);
  const returnTo = safePapersReturnTo(String(formData.get("returnTo") ?? "/papers"));

  if (!ids.length) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}plan=empty`);
  }

  const papers = await prisma.paper.findMany({
    where: { id: { in: ids } },
    orderBy: [{ readStatus: "asc" }, { updatedAt: "desc" }],
  });

  if (!papers.length) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}plan=empty`);
  }

  const marker = readingPlanMarker(papers);
  const existing = await prisma.note.findFirst({
    where: {
      folder: "文献",
      content: { contains: marker, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    redirect(`/notes?note=${existing.id}`);
  }

  const note = await prisma.note.create({
    data: {
      title: `阅读计划 ${new Date().toISOString().slice(0, 10)}`,
      folder: "文献",
      content: buildReadingPlanNote(papers, marker),
      tags: tagsToString(["阅读计划", "文献", "自动整理"]),
    },
  });

  await prisma.paper.updateMany({
    where: {
      id: {
        in: papers
          .filter((paper) => paper.readStatus === "unread")
          .map((paper) => paper.id),
      },
    },
    data: { readStatus: "reading" },
  });

  revalidatePath("/");
  revalidatePath("/papers");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

export async function createLiteratureMatrixNote(formData: FormData) {
  const ids = formData
    .getAll("ids")
    .map((id) => String(id))
    .filter(Boolean)
    .slice(0, 12);
  const returnTo = safePapersReturnTo(String(formData.get("returnTo") ?? "/papers"));

  if (!ids.length) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}matrix=empty`);
  }

  const papers = await prisma.paper.findMany({
    where: { id: { in: ids } },
    orderBy: [{ readStatus: "asc" }, { updatedAt: "desc" }],
  });

  if (!papers.length) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}matrix=empty`);
  }

  const marker = literatureMatrixMarker(papers);
  const existing = await prisma.note.findFirst({
    where: {
      folder: "文献",
      content: { contains: marker, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    redirect(`/notes?note=${existing.id}`);
  }

  const note = await prisma.note.create({
    data: {
      title: `文献综述矩阵 ${new Date().toISOString().slice(0, 10)}`,
      folder: "文献",
      content: buildLiteratureMatrixNote(papers, marker),
      tags: tagsToString(["文献综述", "对比矩阵", "related-work", "自动整理"]),
    },
  });

  revalidatePath("/");
  revalidatePath("/papers");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

function paperNoteMarker(id: string) {
  return `paper-reading-note:${id}`;
}

function paperExperimentMarker(id: string) {
  return `paper-experiment-draft:${id}`;
}

function paperTaskMarker(id: string) {
  return `paper-task:${id}`;
}

function readingPlanMarker(papers: Paper[]) {
  const day = new Date().toISOString().slice(0, 10);
  const key = papers
    .map((paper) => paper.id)
    .sort()
    .join("|");
  return `reading-plan:${day}:${stableHash(key)}`;
}

function literatureMatrixMarker(papers: Paper[]) {
  const day = new Date().toISOString().slice(0, 10);
  const key = papers
    .map((paper) => paper.id)
    .sort()
    .join("|");
  return `literature-matrix:${day}:${stableHash(key)}`;
}

function buildReadingPlanNote(papers: Paper[], marker: string) {
  const lines = [
    `<!-- ${marker} -->`,
    `# 阅读计划 ${new Date().toISOString().slice(0, 10)}`,
    "",
    "> 先读最相关的 2-3 篇，不追求一次读完。读完后把真正有用的内容沉淀成单篇阅读笔记或项目任务。",
    "",
    "## 今天要回答的问题",
    "",
    "- [ ] 这组文献共同在解决什么问题？",
    "- [ ] 哪篇最接近当前课题/实验？",
    "- [ ] 哪个方法、数据或评价指标可以复用？",
    "",
    "## 阅读队列",
    "",
  ];

  papers.forEach((paper, index) => {
    const authors = parseTags(paper.authors).slice(0, 4).join(", ") || "作者未知";
    const source = [paper.journal, paper.year ? String(paper.year) : "", paper.category]
      .filter(Boolean)
      .join("；") || "来源未填";

    lines.push(
      `### ${index + 1}. ${paper.title}`,
      "",
      ...[
        `- 状态：${paperStatusText(paper.readStatus)}`,
        `- 作者：${authors}`,
        `- 来源：${source}`,
        paper.doi ? `- DOI：${paper.doi}` : null,
        paper.arxivId ? `- arXiv：${paper.arxivId}` : null,
        paper.externalUrl ? `- 链接：${paper.externalUrl}` : null,
      ].filter((line): line is string => Boolean(line)),
      "",
      "需要读出的东西：",
      "- [ ] 一句话问题：",
      "- [ ] 方法抓手：",
      "- [ ] 关键结果：",
      "- [ ] 对当前课题的用处：",
      "",
    );
  });

  lines.push(
    "## 读完后的动作",
    "",
    "- [ ] 给最有用的文献生成单篇阅读笔记",
    "- [ ] 把可复用方法或待验证想法拆成项目任务",
    "- [ ] 把需要做对照的部分写进实验日志",
    "- [ ] 把综述/引言可用句子移到写作笔记",
  );

  return lines.join("\n");
}

function buildLiteratureMatrixNote(papers: Paper[], marker: string) {
  const lines = [
    `<!-- ${marker} -->`,
    `# 文献综述矩阵 ${new Date().toISOString().slice(0, 10)}`,
    "",
    "> 这是人工综述前的结构化表格，不自动补事实。先把每篇论文的问题、方法、数据、指标和可复用点补齐，再改写成 related work 或组会材料。",
    "",
    "## 本轮综述要回答的问题",
    "",
    "- [ ] 这批文献共同在解决什么问题？",
    "- [ ] 哪些方法或实验设置可以直接迁移到当前课题？",
    "- [ ] 哪些数据、指标或对照需要我们补实验？",
    "- [ ] related work 应该按什么维度分组？",
    "",
    "## 对比矩阵",
    "",
    "| 文献 | 状态 | 问题/任务 | 方法抓手 | 数据/实验设置 | 指标/结果 | 可复用点 | 待补问题 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  papers.forEach((paper) => {
    const authors = parseTags(paper.authors).slice(0, 2).join(", ") || "作者未知";
    const source = [paper.year ? String(paper.year) : "", paper.journal || paper.category]
      .filter(Boolean)
      .join(" · ") || "来源未填";
    const briefNote = matrixCell(paper.notes || paper.abstract || "");
    const titleCell = `${paper.title}<br>${authors} · ${source}`;

    lines.push(
      `| ${matrixCell(titleCell)} | ${paperStatusText(paper.readStatus)} | 待补 | 待补 | 待补 | ${briefNote || "待补"} | 待补 | 待补 |`,
    );
  });

  lines.push(
    "",
    "## 分组草稿",
    "",
    "- 方法路线 A：",
    "- 方法路线 B：",
    "- 数据/实验设置差异：",
    "- 与当前课题最相关的 3 篇：",
    "",
    "## 读后动作",
    "",
    "- [ ] 把可复现实验生成实验草稿",
    "- [ ] 把关键结果或指标登记到成果页",
    "- [ ] 把 related work 可用表述沉淀到写作笔记",
    "- [ ] 把仍然模糊的问题列给导师/组会讨论",
  );

  return lines.join("\n");
}

function matrixCell(value: string) {
  return value
    .replace(/\r?\n/g, "<br>")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function buildPaperReadingNote(paper: Paper) {
  const authors = parseTags(paper.authors).join(", ") || "作者未知";
  const tags = parseTags(paper.tags);
  const source = [
    paper.journal,
    paper.year ? String(paper.year) : "",
    paper.doi ? `DOI: ${paper.doi}` : "",
    paper.arxivId ? `arXiv: ${paper.arxivId}` : "",
  ].filter(Boolean).join("；") || "来源未填";

  return [
    `<!-- ${paperNoteMarker(paper.id)} -->`,
    `# 阅读：${paper.title}`,
    "",
    "## 文献信息",
    "",
    `- 作者：${authors}`,
    `- 来源：${source}`,
    `- 阅读状态：${paperStatusText(paper.readStatus)}`,
    `- 分类：${paper.category || "未分类"}`,
    paper.externalUrl ? `- 链接：${paper.externalUrl}` : null,
    tags.length ? `- 标签：${tags.join(" / ")}` : null,
    "",
    "## 一句话问题",
    "",
    "- 这篇论文要解决什么问题？",
    "",
    "## 方法抓手",
    "",
    "- 核心方法 / 实验设计：",
    "- 关键假设：",
    "- 数据或设备条件：",
    "",
    "## 关键结果",
    "",
    "- 最重要的图表 / 指标：",
    "- 支撑结论的证据：",
    "",
    "## 可复用点",
    "",
    "- 可以借鉴的实验设置：",
    "- 可以写进综述或引言的观点：",
    "- 可以转成项目任务的下一步：",
    "",
    "## 疑问",
    "",
    "- [ ] 需要回头查的细节：",
    "",
    "## 原始摘要 / 备注",
    "",
    paper.abstract?.trim() || paper.notes?.trim() || "暂无摘要或备注。",
  ].filter((line) => line !== null).join("\n");
}

function buildPaperExperimentDraft(paper: Paper, marker: string) {
  const authors = parseTags(paper.authors).slice(0, 5).join(", ") || "作者未知";
  const source = [
    paper.journal,
    paper.year ? String(paper.year) : "",
    paper.doi ? `DOI: ${paper.doi}` : "",
    paper.arxivId ? `arXiv: ${paper.arxivId}` : "",
  ].filter(Boolean).join("；") || "来源未填";

  return [
    `<!-- ${marker} -->`,
    "## 目的",
    "",
    `从文献《${paper.title}》提取一个可验证的实验想法。`,
    "",
    "要回答的问题：",
    "- 这篇论文的哪个方法、对照、数据处理或评价指标值得复现？",
    "- 它和当前课题的哪一步有关？",
    "- 成功或失败后能产生什么证据？",
    "",
    "## 文献线索",
    "",
    `- 作者：${authors}`,
    `- 来源：${source}`,
    `- Zotero/集合：${paper.category || "未分类"}`,
    paper.externalUrl ? `- 链接：${paper.externalUrl}` : null,
    "",
    "## 方法 / 参数",
    "",
    "- 复现目标：",
    "- 数据/样品/设备条件：",
    "- 关键变量：",
    "- 对照组：",
    "- 评价指标：",
    "",
    "## 观察",
    "",
    "- 先记录最小可运行结果，不追求一步到位。",
    "",
    "## 结论 / 下一步",
    "",
    "- 这篇文献的方法是否能迁移到当前课题：",
    "- 需要补的实验或数据：",
    "- 可以登记到成果页的指标/图表：",
    "",
    "## 原始摘要 / 阅读备注",
    "",
    paper.abstract?.trim() || paper.notes?.trim() || "暂无摘要或阅读备注。",
  ].filter((line) => line !== null).join("\n");
}

function buildPaperTaskDescription(paper: Paper, marker: string) {
  const source = [
    paper.journal,
    paper.year ? String(paper.year) : "",
    paper.doi ? `DOI: ${paper.doi}` : "",
    paper.arxivId ? `arXiv: ${paper.arxivId}` : "",
  ].filter(Boolean).join("；") || "来源未填";

  return [
    `<!-- ${marker} -->`,
    `来自文献：《${paper.title}》`,
    "",
    `来源：${source}`,
    `集合：${paper.category || "未分类"}`,
    paper.externalUrl ? `链接：${paper.externalUrl}` : null,
    "",
    "下一步：",
    "- [ ] 提取一个可验证的方法、对照、数据处理或评价指标",
    "- [ ] 判断是否需要转成实验日志",
    "- [ ] 读完后生成阅读笔记或综述矩阵",
    "",
    "原始摘要 / 备注：",
    paper.abstract?.trim() || paper.notes?.trim() || "暂无摘要或备注。",
  ].filter((line) => line !== null).join("\n");
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
  let result: Awaited<ReturnType<typeof fetchZoteroPapers>>;

  try {
    result = await fetchZoteroPapers();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zotero 同步失败。";
    redirect(`/papers?sync=error&message=${encodeURIComponent(message)}`);
  }

  const { papers, summary } = result;

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

  const params = new URLSearchParams({
    sync: "success",
    count: String(papers.length),
    fetched: String(summary.fetchedItems),
    limit: String(summary.requestedLimit),
    scope: summary.scopeLabel,
    more: summary.hasMore ? "true" : "false",
  });
  if (summary.totalResults !== null) {
    params.set("total", String(summary.totalResults));
  }

  redirect(`/papers?${params.toString()}`);
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

export async function attachTaskToMilestone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const returnTo = safeProjectsReturnTo(String(formData.get("returnTo") ?? "/projects"));
  const joiner = returnTo.includes("?") ? "&" : "?";

  if (!id || !milestoneId) {
    redirect(`${returnTo}${joiner}taskAttach=error`);
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { id: true },
  });

  if (!milestone) {
    redirect(`${returnTo}${joiner}taskAttach=error`);
  }

  await prisma.task.update({
    where: { id },
    data: { milestoneId },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect(`${returnTo}${joiner}taskAttach=success`);
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

export async function createProjectProgressNote(formData: FormData) {
  const ids = formData
    .getAll("ids")
    .map((id) => String(id))
    .filter(Boolean)
    .slice(0, 12);
  const returnTo = safeProjectsReturnTo(String(formData.get("returnTo") ?? "/projects"));
  const joiner = returnTo.includes("?") ? "&" : "?";

  if (!ids.length) {
    redirect(`${returnTo}${joiner}taskPlan=empty`);
  }

  const tasks = await prisma.task.findMany({
    where: { id: { in: ids } },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    include: { milestone: { include: { project: true } } },
  });

  if (!tasks.length) {
    redirect(`${returnTo}${joiner}taskPlan=empty`);
  }

  const marker = projectProgressMarker(tasks);
  const existing = await prisma.note.findFirst({
    where: {
      folder: "项目",
      content: { contains: marker, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    redirect(`/notes?note=${existing.id}`);
  }

  const note = await prisma.note.create({
    data: {
      title: `课题推进 ${new Date().toISOString().slice(0, 10)}`,
      folder: "项目",
      content: buildProjectProgressNote(tasks, marker),
      tags: tagsToString(["课题推进", "周计划", "自动整理"]),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

function projectProgressMarker(tasks: Array<Task & { milestone: (Milestone & { project: Project }) | null }>) {
  const day = new Date().toISOString().slice(0, 10);
  const key = tasks
    .map((task) => task.id)
    .sort()
    .join("|");
  return `project-progress:${day}:${stableHash(key)}`;
}

function buildProjectProgressNote(
  tasks: Array<Task & { milestone: (Milestone & { project: Project }) | null }>,
  marker: string,
) {
  const groups = groupTasksByProject(tasks);
  const lines = [
    `<!-- ${marker} -->`,
    `# 课题推进 ${new Date().toISOString().slice(0, 10)}`,
    "",
    "> 这份清单来自项目页当前任务队列。先确认本周真正要推进的 1-3 件事，再把能实验化的动作转到实验日志。",
    "",
    "## 本次推进目标",
    "",
    "- [ ] 今天/本周必须完成：",
    "- [ ] 需要导师确认：",
    "- [ ] 可以转成实验或结果证据：",
    "",
  ];

  groups.forEach((group) => {
    lines.push(`## ${group.projectTitle}`, "");

    group.tasks.forEach((task) => {
      lines.push(
        `- [ ] ${task.title}`,
        `  - 里程碑：${task.milestone?.title ?? "未挂载"}`,
        `  - 状态：${taskStatusText(task.status)}；优先级：${taskPriorityText(task.priority)}；截止：${dateText(task.dueDate)}`,
        task.description?.trim() ? `  - 备注：${oneLine(task.description, 120)}` : "",
      );
    });

    lines.push("");
  });

  lines.push(
    "## 推进后回填",
    "",
    "- [ ] 完成的任务标记为完成",
    "- [ ] 需要实验验证的任务转成实验日志",
    "- [ ] 产出的指标或图表登记到成果页",
    "- [ ] 新出现的阻塞写回项目任务",
  );

  return lines.join("\n");
}

function groupTasksByProject(tasks: Array<Task & { milestone: (Milestone & { project: Project }) | null }>) {
  const groups = new Map<string, { projectTitle: string; tasks: typeof tasks }>();

  tasks.forEach((task) => {
    const projectTitle = task.milestone?.project.title ?? "独立任务";
    const key = task.milestone?.project.id ?? "standalone";
    const current = groups.get(key);

    if (current) {
      current.tasks.push(task);
      return;
    }

    groups.set(key, { projectTitle, tasks: [task] });
  });

  return Array.from(groups.values());
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

export async function createExperimentReviewNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const experiment = await prisma.experiment.findUnique({
    where: { id },
    include: {
      project: true,
      papers: true,
      results: {
        orderBy: { updatedAt: "desc" },
        include: { dataset: true },
      },
    },
  });

  if (!experiment) return;

  const marker = experimentNoteMarker(experiment.id);
  const existing = await prisma.note.findFirst({
    where: { content: { contains: marker, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    redirect(`/notes?note=${existing.id}`);
  }

  const note = await prisma.note.create({
    data: {
      title: `复盘：${experiment.title}`.slice(0, 80),
      folder: "实验",
      content: buildExperimentReviewNote(experiment),
      tags: tagsToString([
        "实验复盘",
        experimentStatusText(experiment.status),
        ...parseTags(experiment.tags).slice(0, 4),
      ]),
    },
  });

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath("/experiments");
  redirect(`/notes?note=${note.id}`);
}

function experimentNoteMarker(id: string) {
  return `experiment-review-note:${id}`;
}

function buildExperimentReviewNote(
  experiment: Experiment & {
    project: Project | null;
    papers: Paper[];
    results: Array<Result & { dataset: Dataset | null }>;
  },
) {
  const linkedPapers = experiment.papers.length
    ? experiment.papers.map((paper) => `- ${paper.title}`).join("\n")
    : "- 暂无关联论文";
  const resultLines = experiment.results.length
    ? experiment.results.map((result) => {
        const metrics = parseJsonObjectText(result.metrics);
        const metricText = Object.entries(metrics)
          .filter(([, value]) => String(value).trim())
          .slice(0, 5)
          .map(([key, value]) => `${key}: ${String(value)}`)
          .join("；") || "未填写指标";

        return [
          `- ${result.title}`,
          `  - 数据集：${result.dataset?.name ?? "未关联数据集"}`,
          `  - 指标：${metricText}`,
          result.notes?.trim() ? `  - 结论：${oneLine(result.notes, 120)}` : "",
        ].filter(Boolean).join("\n");
      }).join("\n")
    : "- 暂无结果记录";

  return [
    `<!-- ${experimentNoteMarker(experiment.id)} -->`,
    `# 实验复盘：${experiment.title}`,
    "",
    "## 基本信息",
    "",
    `- 项目：${experiment.project?.title ?? "未关联项目"}`,
    `- 状态：${experimentStatusText(experiment.status)}`,
    `- 模板：${experiment.template}`,
    `- 更新时间：${dateText(experiment.updatedAt)}`,
    "",
    "## 实验目的",
    "",
    experimentSnippet(experiment.content),
    "",
    "## 关联论文",
    "",
    linkedPapers,
    "",
    "## 结果证据",
    "",
    resultLines,
    "",
    "## 复盘结论",
    "",
    "- 这次实验说明了什么：",
    "- 可信度 / 复现状态：",
    "- 对论文或组会最有用的一句话：",
    "",
    "## 失败或异常",
    "",
    "- 主要异常现象：",
    "- 可能原因：",
    "- 需要补做的对照：",
    "",
    "## 下一步",
    "",
    "- [ ] 补充需要复现的结果",
    "- [ ] 把下一次实验拆成项目任务",
    "- [ ] 把可写入论文的图表或指标登记到成果页",
    "",
    "## 原始实验记录",
    "",
    experiment.content || "暂无原始实验内容。",
  ].join("\n");
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

export async function createNoteFromAiDraft(formData: FormData) {
  const prompt = String(formData.get("prompt") ?? "").trim().slice(0, 4_000);
  const draft = String(formData.get("draft") ?? "").trim().slice(0, 20_000);
  const provider = String(formData.get("provider") ?? "AI").trim().slice(0, 80);
  const mode = String(formData.get("mode") ?? "live").trim().slice(0, 40);

  if (!draft) {
    redirect("/ai");
  }

  const note = await prisma.note.create({
    data: {
      title: `AI 草稿：${new Date().toLocaleDateString("zh-CN")}`,
      folder: "写作",
      content: aiDraftNoteMarkdown({ draft, mode, prompt, provider }),
      tags: tagsToString(["AI 草稿", "写作素材", "待核对"]),
    },
  });

  revalidatePath("/");
  revalidatePath("/ai");
  revalidatePath("/notes");
  redirect(`/notes?captured=note&note=${note.id}`);
}

export async function quickCapture(formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;

  const captured = parseQuickCapture(content);

  if (captured.kind === "task") {
    await prisma.task.create({
      data: {
        title: quickTitle(captured.body),
        description: `来自快速捕捉：${captured.body}`,
        priority: "medium",
        status: "todo",
        tags: tagsToString(["quick-capture"]),
      },
    });

    revalidatePath("/");
    revalidatePath("/projects");
    redirect("/projects?captured=task&status=todo");
  }

  if (captured.kind === "experiment") {
    await prisma.experiment.create({
      data: {
        title: quickTitle(captured.body),
        status: "running",
        template: "purpose-method-result",
        content: [
          "## 目的",
          captured.body,
          "",
          "## 方法 / 参数",
          "",
          "## 观察",
          "",
          "## 结论 / 下一步",
          "",
          "---",
          "来源：快速捕捉",
        ].join("\n"),
        tags: tagsToString(["quick-capture", "待补全"]),
      },
    });

    revalidatePath("/");
    revalidatePath("/experiments");
    redirect("/experiments?captured=experiment&status=running");
  }

  if (captured.kind === "paper") {
    await prisma.paper.create({
      data: {
        title: quickTitle(captured.body),
        category: "inbox",
        readStatus: "unread",
        notes: `来自快速捕捉：${captured.body}`,
        tags: tagsToString(["quick-capture"]),
      },
    });

    revalidatePath("/");
    revalidatePath("/papers");
    redirect("/papers?captured=paper&status=unread");
  }

  if (captured.kind === "admin") {
    await prisma.adminItem.create({
      data: {
        title: quickTitle(captured.body),
        type: inferAdminType(captured.body),
        status: "todo",
        notes: `来自快速捕捉：${captured.body}`,
        tags: tagsToString(["quick-capture"]),
      },
    });

    revalidatePath("/");
    revalidatePath("/admin");
    redirect("/admin?captured=admin&status=todo");
  }

  if (captured.kind === "result") {
    await prisma.result.create({
      data: {
        title: quickTitle(captured.body),
        metrics: "{}",
        config: JSON.stringify({
          manuscriptReady: false,
          quickCapture: true,
          reproducibility: "unknown",
        }),
        notes: [
          "结论：待补充。",
          `来源：快速捕捉：${captured.body}`,
          "下一步：补 1-3 个核心指标、关联实验/数据集、复现状态和图表路径。",
        ].join("\n"),
      },
    });

    revalidatePath("/");
    revalidatePath("/data");
    redirect("/data?captured=result");
  }

  if (captured.kind === "dataset") {
    await prisma.dataset.create({
      data: {
        name: quickTitle(captured.body),
        source: "快速捕捉",
        description: [
          "用途：待补充。",
          `来源：快速捕捉：${captured.body}`,
          "处理状态：",
          "依赖结果：",
        ].join("\n"),
        tags: tagsToString(["quick-capture", "数据来源"]),
      },
    });

    revalidatePath("/");
    revalidatePath("/data");
    redirect("/data?captured=dataset");
  }

  const note = await prisma.note.create({
    data: {
      title: quickTitle(captured.body),
      content: quickNoteContent(captured),
      folder: captured.folder ?? "Inbox",
      tags: tagsToString(["quick-capture", ...(captured.tags ?? [])]),
    },
  });

  revalidatePath("/");
  revalidatePath("/notes");
  redirect(`/notes?captured=note&note=${note.id}`);
}

type QuickCaptureResult =
  | { body: string; kind: "task" }
  | { body: string; kind: "experiment" }
  | { body: string; kind: "paper" }
  | { body: string; kind: "admin" }
  | { body: string; kind: "result" }
  | { body: string; kind: "dataset" }
  | { body: string; folder?: string; kind: "note"; tags?: string[] };

function parseQuickCapture(content: string): QuickCaptureResult {
  const prefixed = extractQuickPrefix(content);
  if (!prefixed) {
    return { kind: "note" as const, body: content };
  }

  const captured = quickCaptureAlias(prefixed.prefix);
  if (!captured) {
    return { kind: "note" as const, body: content };
  }

  return { ...captured, body: prefixed.body };
}

function extractQuickPrefix(content: string) {
  const colonMatch = content.match(/^([^:：]{1,16})[:：]\s*(.+)$/);
  if (colonMatch?.[1] && colonMatch[2]?.trim()) {
    return {
      body: colonMatch[2].trim(),
      prefix: colonMatch[1].trim(),
    };
  }

  const tokenMatch = content.match(/^([/#]?[A-Za-z][\w-]{0,15}|[/#]?[\p{Script=Han}]{1,8})\s+(.+)$/u);
  if (tokenMatch?.[1] && tokenMatch[2]?.trim()) {
    return {
      body: tokenMatch[2].trim(),
      prefix: tokenMatch[1].trim(),
    };
  }

  return null;
}

type QuickCaptureAlias =
  | { kind: "task" }
  | { kind: "experiment" }
  | { kind: "paper" }
  | { kind: "admin" }
  | { kind: "result" }
  | { kind: "dataset" }
  | { folder?: string; kind: "note"; tags?: string[] };

function quickCaptureAlias(prefix: string): QuickCaptureAlias | null {
  const key = prefix.trim().replace(/^[/#]/, "").toLowerCase();
  const entries: Array<[string, QuickCaptureAlias]> = [
    ["任务", { kind: "task" }],
    ["待办", { kind: "task" }],
    ["下一步", { kind: "task" }],
    ["行动", { kind: "task" }],
    ["todo", { kind: "task" }],
    ["task", { kind: "task" }],
    ["t", { kind: "task" }],
    ["实验", { kind: "experiment" }],
    ["试验", { kind: "experiment" }],
    ["experiment", { kind: "experiment" }],
    ["exp", { kind: "experiment" }],
    ["e", { kind: "experiment" }],
    ["文献", { kind: "paper" }],
    ["论文", { kind: "paper" }],
    ["阅读", { kind: "paper" }],
    ["article", { kind: "paper" }],
    ["paper", { kind: "paper" }],
    ["p", { kind: "paper" }],
    ["事务", { kind: "admin" }],
    ["提醒", { kind: "admin" }],
    ["组会", { kind: "admin" }],
    ["会议", { kind: "admin" }],
    ["截止", { kind: "admin" }],
    ["材料", { kind: "admin" }],
    ["报销", { kind: "admin" }],
    ["meeting", { kind: "admin" }],
    ["deadline", { kind: "admin" }],
    ["admin", { kind: "admin" }],
    ["结果", { kind: "result" }],
    ["成果", { kind: "result" }],
    ["证据", { kind: "result" }],
    ["result", { kind: "result" }],
    ["evidence", { kind: "result" }],
    ["数据", { kind: "dataset" }],
    ["数据集", { kind: "dataset" }],
    ["dataset", { kind: "dataset" }],
    ["data", { kind: "dataset" }],
    ["笔记", { kind: "note", folder: "Inbox" }],
    ["想法", { kind: "note", folder: "Inbox", tags: ["想法"] }],
    ["灵感", { kind: "note", folder: "Inbox", tags: ["想法"] }],
    ["idea", { kind: "note", folder: "Inbox", tags: ["想法"] }],
    ["note", { kind: "note", folder: "Inbox" }],
    ["写作", { kind: "note", folder: "写作", tags: ["写作素材"] }],
    ["周报", { kind: "note", folder: "写作", tags: ["周报"] }],
    ["初稿", { kind: "note", folder: "写作", tags: ["论文初稿"] }],
    ["draft", { kind: "note", folder: "写作", tags: ["论文初稿"] }],
  ];
  const kindMap = new Map<string, QuickCaptureAlias>(entries);

  return kindMap.get(key) ?? null;
}

function quickNoteContent(captured: Extract<QuickCaptureResult, { kind: "note" }>) {
  if (!captured.folder || captured.folder === "Inbox") {
    return captured.body;
  }

  return [
    "## 快速记录",
    "",
    captured.body,
    "",
    "---",
    "来源：快速捕捉",
  ].join("\n");
}

function quickTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 42) || "快速捕捉";
}

function inferAdminType(value: string): AdminItem["type"] {
  if (/组会|会议|汇报|seminar|meeting/i.test(value)) return "meeting";
  if (/报销|发票|经费|reimbursement/i.test(value)) return "reimbursement";
  if (/材料|表格|证明|申请|material/i.test(value)) return "material";
  return "deadline";
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
  return stableHash(value);
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function noteTaskMarker(noteId: string, key: string) {
  return `<!-- note-task:${noteId}:${key} -->`;
}

function aiDraftNoteMarkdown({
  draft,
  mode,
  prompt,
  provider,
}: {
  draft: string;
  mode: string;
  prompt: string;
  provider: string;
}) {
  return [
    `<!-- ai-draft:${stableHash(`${provider}:${prompt}:${draft}`).slice(0, 12)} -->`,
    "",
    "## AI 草稿",
    "",
    draft,
    "",
    "## 原始提示",
    "",
    prompt || "未记录提示。",
    "",
    "## 核对清单",
    "",
    "- [ ] 核对事实、数据和实验条件",
    "- [ ] 核对引用来源和文献表述",
    "- [ ] 标注哪些内容可以进入组会、周报或论文",
    "- [ ] 把下一步动作拆回任务或实验",
    "",
    "---",
    `来源：AI 草稿助手 · ${provider} · ${mode}`,
  ].join("\n");
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
      tags: tagsToString(["组会", "周报", "导师沟通", "自动整理"]),
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

export async function createMeetingFeedbackNote(formData: FormData) {
  const rawScope = String(formData.get("scope") ?? "week");
  const scope: MeetingBriefScope = rawScope === "today" ? "today" : "week";
  const now = new Date();
  const period = getMeetingBriefPeriod(now, scope);
  const marker = meetingFeedbackMarker(scope, period.start);

  const existingNote = await prisma.note.findFirst({
    where: {
      folder: "组会",
      content: { contains: marker, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existingNote) {
    redirect(`/notes?note=${existingNote.id}`);
  }

  const [meetingBrief, recentTasks, recentResults] = await Promise.all([
    prisma.note.findFirst({
      where: {
        folder: "组会",
        content: { contains: period.marker, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true },
    }),
    prisma.task.findMany({
      where: {
        status: { not: "done" },
        OR: [{ priority: "high" }, { dueDate: { lt: period.endExclusive } }],
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 6,
      include: { milestone: { include: { project: true } } },
    }),
    prisma.result.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { experiment: { include: { project: true } } },
    }),
  ]);

  const note = await prisma.note.create({
    data: {
      title: `导师反馈回填 ${period.shortLabel}`,
      folder: "组会",
      content: meetingFeedbackMarkdown({
        generatedAt: now,
        marker,
        period,
        meetingBrief,
        recentTasks,
        recentResults,
      }),
      tags: tagsToString(["导师反馈", "组会", "任务回填", "自动整理"]),
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

export async function createDailyPlanNote() {
  const now = new Date();
  const period = getDailyPlanPeriod(now);

  const existingNote = await prisma.note.findFirst({
    where: {
      folder: "日计划",
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
        OR: [
          { dueDate: { lt: period.endExclusive } },
          { priority: "high" },
          { status: "doing" },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 12,
      include: { milestone: { include: { project: true } } },
    }),
    prisma.adminItem.findMany({
      where: {
        status: { not: "done" },
        OR: [{ dueDate: { lt: period.endExclusive } }, { type: "meeting" }],
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 5,
    }),
    prisma.experiment.findMany({
      where: { status: "running" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { project: true, results: true },
    }),
    prisma.result.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { dataset: true, experiment: { include: { project: true } } },
    }),
    prisma.paper.findMany({
      where: { readStatus: { in: ["unread", "reading"] } },
      orderBy: [{ readStatus: "asc" }, { updatedAt: "desc" }],
      take: 5,
    }),
  ]);

  const rankedTasks = tasks
    .sort((left, right) => taskRank(left) - taskRank(right))
    .slice(0, 8);

  const note = await prisma.note.create({
    data: {
      title: period.title,
      folder: "日计划",
      content: dailyPlanMarkdown({
        generatedAt: now,
        period,
        tasks: rankedTasks,
        adminItems,
        experiments,
        results,
        papers,
      }),
      tags: tagsToString(["日计划", "今日开工", "自动整理"]),
    },
  });

  revalidatePath("/");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

export async function createClosingReviewNote() {
  const now = new Date();
  const marker = closingReviewMarker(now);

  const existingNote = await prisma.note.findFirst({
    where: {
      folder: "日计划",
      content: { contains: marker, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existingNote) {
    redirect(`/notes?note=${existingNote.id}`);
  }

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const staleSince = new Date(todayStart);
  staleSince.setDate(staleSince.getDate() - 7);
  const readingSince = new Date(todayStart);
  readingSince.setDate(readingSince.getDate() - 14);

  const [overdueTasks, staleTasks, staleExperiments, results, stalePapers] = await Promise.all([
    prisma.task.findMany({
      where: {
        status: { not: "done" },
        dueDate: { lt: todayStart },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 8,
      include: { milestone: { include: { project: true } } },
    }),
    prisma.task.findMany({
      where: {
        status: "doing",
        updatedAt: { lt: staleSince },
      },
      orderBy: { updatedAt: "asc" },
      take: 8,
      include: { milestone: { include: { project: true } } },
    }),
    prisma.experiment.findMany({
      where: {
        status: "running",
        updatedAt: { lt: staleSince },
      },
      orderBy: { updatedAt: "asc" },
      take: 8,
      include: { project: true, results: true },
    }),
    prisma.result.findMany({
      orderBy: { updatedAt: "asc" },
      take: 12,
      include: { dataset: true, experiment: { include: { project: true } } },
    }),
    prisma.paper.findMany({
      where: {
        readStatus: { in: ["unread", "reading"] },
        updatedAt: { lt: readingSince },
      },
      orderBy: { updatedAt: "asc" },
      take: 8,
    }),
  ]);

  const note = await prisma.note.create({
    data: {
      title: `今日收口清单 ${now.toISOString().slice(0, 10)}`,
      folder: "日计划",
      content: closingReviewMarkdown({
        generatedAt: now,
        marker,
        overdueTasks,
        staleTasks,
        staleExperiments,
        results: results.filter(resultNeedsClosing).slice(0, 8),
        stalePapers,
      }),
      tags: tagsToString(["收口清单", "日计划", "自动整理"]),
    },
  });

  revalidatePath("/");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

export async function createFirstRunGuideNote() {
  const marker = firstRunGuideMarker();
  const existingNote = await prisma.note.findFirst({
    where: {
      folder: "上手",
      content: { contains: marker, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existingNote) {
    redirect(`/notes?note=${existingNote.id}`);
  }

  const now = new Date();
  const note = await prisma.note.create({
    data: {
      title: "研途 Hub 10 分钟上手清单",
      folder: "上手",
      content: firstRunGuideMarkdown(now, marker),
      tags: tagsToString(["上手清单", "开箱", "自动整理"]),
    },
  });

  revalidatePath("/");
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

export async function createDatasetAuditNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: {
      results: {
        orderBy: { updatedAt: "desc" },
        include: { experiment: true },
      },
    },
  });

  if (!dataset) return;

  const marker = datasetAuditMarker(dataset.id);
  const existing = await prisma.note.findFirst({
    where: { content: { contains: marker, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existing) {
    redirect(`/notes?note=${existing.id}`);
  }

  const note = await prisma.note.create({
    data: {
      title: `数据复现清单：${dataset.name}`.slice(0, 80),
      folder: "结果",
      content: buildDatasetAuditNote(dataset, marker),
      tags: tagsToString(["数据复现", "数据来源", ...parseTags(dataset.tags).slice(0, 4)]),
    },
  });

  revalidatePath("/");
  revalidatePath("/data");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
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

export async function createResultFromExperiment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const experiment = await prisma.experiment.findUnique({ where: { id } });
  if (!experiment) return;

  const marker = `"sourceExperimentId":"${experiment.id}"`;
  const existing = await prisma.result.findFirst({
    where: {
      experimentId: experiment.id,
      config: { contains: marker },
    },
    select: { id: true },
  });

  if (existing) {
    redirect(`/data?experiment=${experiment.id}`);
  }

  await prisma.result.create({
    data: {
      title: `结果证据：${experiment.title}`.slice(0, 100),
      experimentId: experiment.id,
      metrics: "{}",
      config: JSON.stringify({
        reproducibility: experiment.status === "completed" ? "todo" : "unknown",
        manuscriptReady: false,
        sourceExperimentId: experiment.id,
      }),
      notes: [
        "结论：待从实验观察中提炼。",
        `来源实验：${experiment.title}`,
        `实验摘要：${experimentSnippet(experiment.content)}`,
        "下一步：补 1-3 个核心指标、复现状态和图表路径。",
      ].join("\n"),
    },
  });

  revalidatePath("/");
  revalidatePath("/experiments");
  revalidatePath("/data");
  redirect(`/data?experiment=${experiment.id}`);
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

export async function createWritingNoteFromResult(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const result = await prisma.result.findUnique({
    where: { id },
    include: {
      dataset: true,
      experiment: {
        include: {
          project: true,
          papers: true,
        },
      },
    },
  });

  if (!result) return;

  const marker = resultWritingNoteMarker(result.id);
  const existing = await prisma.note.findFirst({
    where: { content: { contains: marker, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    redirect(`/notes?note=${existing.id}`);
  }

  const note = await prisma.note.create({
    data: {
      title: `写作素材：${result.title}`.slice(0, 80),
      folder: "写作",
      content: buildResultWritingNote(result),
      tags: tagsToString(["论文素材", "结果证据", reproducibilityTextFromResult(result), ...resultContextTags(result)]),
    },
  });

  revalidatePath("/");
  revalidatePath("/data");
  revalidatePath("/notes");
  redirect(`/notes?note=${note.id}`);
}

export async function createWritingPackNote() {
  const now = new Date();
  const period = getWritingPackPeriod(now);

  const existingNote = await prisma.note.findFirst({
    where: {
      folder: "写作",
      content: { contains: period.marker, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (existingNote) {
    redirect(`/notes?note=${existingNote.id}`);
  }

  const [results, writingNotes, papers] = await Promise.all([
    prisma.result.findMany({
      where: {
        OR: [
          { artifactPath: { not: null } },
          { config: { contains: "\"manuscriptReady\":true" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        dataset: true,
        experiment: {
          include: {
            project: true,
          },
        },
      },
    }),
    prisma.note.findMany({
      where: {
        OR: [
          { folder: { contains: "写作", mode: "insensitive" } },
          { folder: { contains: "阅读", mode: "insensitive" } },
          { folder: { contains: "文献", mode: "insensitive" } },
          { folder: { contains: "结果", mode: "insensitive" } },
          { folder: { contains: "实验", mode: "insensitive" } },
          { folder: { contains: "组会", mode: "insensitive" } },
          { tags: { contains: "论文素材", mode: "insensitive" } },
          { tags: { contains: "写作素材", mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.paper.findMany({
      where: {
        readStatus: { in: ["reading", "read"] },
      },
      orderBy: [{ readStatus: "desc" }, { updatedAt: "desc" }],
      take: 10,
    }),
  ]);

  const note = await prisma.note.create({
    data: {
      title: period.title,
      folder: "写作",
      content: writingPackMarkdown({
        generatedAt: now,
        period,
        results,
        writingNotes,
        papers,
      }),
      tags: tagsToString(["写作素材", "论文初稿", "自动整理"]),
    },
  });

  revalidatePath("/");
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

function resultWritingNoteMarker(id: string) {
  return `result-writing-note:${id}`;
}

function datasetAuditMarker(id: string) {
  return `dataset-audit:${id}`;
}

function buildDatasetAuditNote(
  dataset: Dataset & {
    results: Array<
      Result & {
        experiment: Experiment | null;
      }
    >;
  },
  marker: string,
) {
  const tags = parseTags(dataset.tags);
  const linkedResults = dataset.results.length
    ? dataset.results.slice(0, 12).map((result, index) => {
        const config = parseJsonObjectText(result.config);
        const reproducibility = reproducibilityText(String(config.reproducibility ?? "unknown"));
        const manuscriptReady = config.manuscriptReady ? "是" : result.artifactPath ? "有图表路径" : "否";

        return [
          `### ${index + 1}. ${result.title}`,
          `- 关联实验：${result.experiment?.title ?? "未关联实验"}`,
          `- 复现状态：${reproducibility}`,
          `- 可写入论文/组会：${manuscriptReady}`,
          `- 图表或结果文件：${result.artifactPath || "待补"}`,
          `- 一句话结论：${result.notes?.trim() || "待补"}`,
        ].join("\n");
      }).join("\n\n")
    : "暂无关联结果。可以先到成果页把关键结果关联到这个数据来源。";

  return [
    `<!-- ${marker} -->`,
    `# 数据复现清单：${dataset.name}`,
    "",
    "> 这不是完整数据仓库文档，只用来确认以后能找回、复现、交接和写进组会/论文。",
    "",
    "## 数据来源",
    "",
    `- 名称：${dataset.name}`,
    `- 来源：${dataset.source || "待补"}`,
    `- 版本：${dataset.version || "待补"}`,
    `- 本地/服务器路径：${dataset.path || "待补"}`,
    `- 外部链接：${dataset.externalUrl || "待补"}`,
    tags.length ? `- 标签：${tags.join(" / ")}` : "- 标签：待补",
    "",
    "## 复现核对",
    "",
    "- [ ] 数据路径仍然可访问",
    "- [ ] 版本、清洗规则或采集批次写清楚",
    "- [ ] 依赖这个数据的结果已经关联到成果页",
    "- [ ] 图表/结果文件路径能从当前环境找回",
    "- [ ] 如果要交接或开源，已标明可公开范围和限制",
    "",
    "## 处理说明",
    "",
    dataset.description?.trim() || "- 用途：\n- 处理状态：\n- 依赖结果：",
    "",
    "## 依赖结果",
    "",
    linkedResults,
    "",
    "## 下次要补",
    "",
    "- [ ] 补缺失的版本、路径或外部链接",
    "- [ ] 确认至少一条关键结果已关联该数据来源",
    "- [ ] 如需组会或论文，生成对应结果的写作素材笔记",
  ].join("\n");
}

function buildResultWritingNote(
  result: Result & {
    dataset: Dataset | null;
    experiment:
      | (Experiment & {
          project: Project | null;
          papers: Paper[];
        })
      | null;
  },
) {
  const config = parseJsonObjectText(result.config);
  const metrics = parseJsonObjectText(result.metrics);
  const metricText = Object.entries(metrics)
    .filter(([, value]) => String(value).trim())
    .slice(0, 8)
    .map(([key, value]) => `- ${key}: ${String(value)}`)
    .join("\n") || "- 未填写核心指标";
  const linkedPapers = result.experiment?.papers.length
    ? result.experiment.papers.map((paper) => `- ${paper.title}`).join("\n")
    : "- 暂无关联文献";
  const manuscriptReady = config.manuscriptReady ? "是" : result.artifactPath ? "有图表或结果文件" : "否";

  return [
    `<!-- ${resultWritingNoteMarker(result.id)} -->`,
    `# 写作素材：${result.title}`,
    "",
    "## 一句话结论",
    "",
    result.notes?.trim() || "- 这条结果说明：",
    "",
    "## 证据来源",
    "",
    `- 项目：${result.experiment?.project?.title ?? "未关联项目"}`,
    `- 实验：${result.experiment?.title ?? "未关联实验"}`,
    `- 数据集：${result.dataset?.name ?? "未关联数据集"}`,
    `- 更新时间：${dateText(result.updatedAt)}`,
    `- 复现状态：${reproducibilityText(String(config.reproducibility ?? "unknown"))}`,
    `- 可写入论文/组会：${manuscriptReady}`,
    `- 图表或结果文件：${result.artifactPath || "待补"}`,
    "",
    "## 核心指标",
    "",
    metricText,
    "",
    "## 可直接写进论文/周报的话",
    "",
    "- 本结果表明：",
    "- 与基线或前一轮相比：",
    "- 目前还需要补充的证据：",
    "",
    "## 关联文献",
    "",
    linkedPapers,
    "",
    "## 图表检查",
    "",
    "- [ ] 图表路径可以打开",
    "- [ ] 坐标轴、单位、显著性或误差线已说明",
    "- [ ] 对照组、样本量或数据划分已写清楚",
    "- [ ] 复现实验或失败原因已记录",
    "",
    "## 后续动作",
    "",
    "- [ ] 如果证据不足，到成果页生成待补任务",
    "- [ ] 如果实验记录未收口，到实验页回填结果正文",
    "- [ ] 如果准备组会，把本段并入本周组会草稿",
  ].join("\n");
}

function writingPackMarkdown({
  generatedAt,
  period,
  results,
  writingNotes,
  papers,
}: {
  generatedAt: Date;
  period: ReturnType<typeof getWritingPackPeriod>;
  results: Array<
    Result & {
      dataset: Dataset | null;
      experiment:
        | (Experiment & {
            project: Project | null;
          })
        | null;
    }
  >;
  writingNotes: Note[];
  papers: Paper[];
}) {
  const lines = [
    period.marker,
    "",
    `# ${period.title}`,
    "",
    `生成时间：${generatedAt.toLocaleString("zh-CN", { hour12: false })}`,
    "",
    "> 这不是自动写论文。它只把最近能用的证据、文献和笔记收在一起，方便你开始写引言、方法、结果或周报。",
    "",
    "## 今天先写哪一段",
    "",
    "- [ ] 引言/相关工作：",
    "- [ ] 方法/实验设置：",
    "- [ ] 结果/讨论：",
    "- [ ] 周报/组会材料：",
    "",
    "## 可写入的结果证据",
    "",
  ];

  if (results.length) {
    results.forEach((result, index) => {
      const config = parseJsonObjectText(result.config);
      const metrics = parseJsonObjectText(result.metrics);
      const metricText = Object.entries(metrics)
        .filter(([, value]) => String(value).trim())
        .slice(0, 5)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join("；") || "未填写核心指标";
      const manuscriptReady = config.manuscriptReady ? "是" : result.artifactPath ? "有图表或结果文件" : "待判断";

      lines.push(
        `### ${index + 1}. ${result.title}`,
        "",
        `- 项目：${result.experiment?.project?.title ?? "未关联项目"}`,
        `- 实验：${result.experiment?.title ?? "未关联实验"}`,
        `- 数据集：${result.dataset?.name ?? "未关联数据集"}`,
        `- 核心指标：${metricText}`,
        `- 复现状态：${reproducibilityText(String(config.reproducibility ?? "unknown"))}`,
        `- 可写入：${manuscriptReady}`,
        `- 图表/结果文件：${result.artifactPath || "待补"}`,
        `- 可直接改写的结论：${result.notes?.trim() || "待补一句话结论"}`,
        "",
      );
    });
  } else {
    lines.push("- 暂无已标记或带图表路径的结果。可以先到成果页把关键结果标成写作素材。", "");
  }

  lines.push("## 文献输入", "");

  if (papers.length) {
    papers.forEach((paper, index) => {
      const authors = parseTags(paper.authors).slice(0, 4).join(", ") || "作者未知";
      lines.push(
        `- ${index + 1}. [${paperStatusText(paper.readStatus)}] ${paper.title}`,
        `  - 作者：${authors}`,
        `  - 来源：${paper.journal || paper.category || "未填写"}；年份：${paper.year ?? "未知"}`,
        paper.notes?.trim() ? `  - 备注：${oneLine(paper.notes, 120)}` : "",
      );
    });
  } else {
    lines.push("- 暂无读中或已读文献。可以先到文献页同步 Zotero 并生成阅读笔记。");
  }

  lines.push("", "## 最近可用笔记", "");

  if (writingNotes.length) {
    writingNotes.forEach((note, index) => {
      const tags = parseTags(note.tags).slice(0, 4).join(" / ");
      const snippet = noteSnippetForMarkdown(note.content);
      lines.push(
        `- ${index + 1}. [[${note.title}]]`,
        `  - 分类：${note.folder}；更新：${dateText(note.updatedAt)}`,
        tags ? `  - 标签：${tags}` : "",
        snippet ? `  - 摘要：${snippet}` : "",
      );
    });
  } else {
    lines.push("- 暂无阅读、实验、结果或组会相关笔记。");
  }

  lines.push(
    "",
    "## 初稿骨架",
    "",
    "### 研究问题",
    "",
    "- 本文/本阶段要解决的问题是：",
    "",
    "### 方法与实验",
    "",
    "- 我们采用/对比的方法：",
    "- 数据、设备或实验条件：",
    "",
    "### 结果与证据",
    "",
    "- 最能支撑结论的结果：",
    "- 还缺的对照或复现：",
    "",
    "### 需要补的材料",
    "",
    "- [ ] 找到对应图表或结果文件",
    "- [ ] 给每个结果补一句话结论",
    "- [ ] 检查引用是否来自 Zotero/阅读笔记",
    "- [ ] 把导师反馈或组会意见拆成下一步任务",
  );

  return lines.join("\n");
}

function noteSnippetForMarkdown(content: string) {
  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text ? oneLine(text, 140) : "";
}

function resultContextTags(
  result: Result & {
    dataset: Dataset | null;
    experiment:
      | (Experiment & {
          project: Project | null;
        })
      | null;
  },
) {
  return [
    result.experiment?.project?.title,
    result.experiment?.title,
    result.dataset?.name,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .slice(0, 3);
}

function reproducibilityTextFromResult(result: Result) {
  const config = parseJsonObjectText(result.config);
  return reproducibilityText(String(config.reproducibility ?? "unknown"));
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

type DailyPlanTask = Task & {
  milestone: (Milestone & { project: Project }) | null;
};

type DailyPlanExperiment = Experiment & {
  project: Project | null;
  results: Result[];
};

type DailyPlanResult = Result & {
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
    "> 自动整理自研途 Hub。先把“本次沟通先看这里”压缩到 5 分钟能讲完，再按需要删减下面的证据材料。",
    "",
    "## 本次沟通先看这里",
    "",
    "- 最想让导师知道的进展：",
    "- 最需要导师判断的问题：",
    "- 会后立刻要做的下一步：",
    "",
    "## 5 分钟汇报版本",
    "",
    "- 本周推进：",
    "- 当前结论：",
    "- 下周最小计划：",
    "- 主要风险 / 阻塞：",
    "",
    "## 需要导师确认",
    "",
    "- [ ] 方向判断：",
    "- [ ] 实验/数据是否需要补：",
    "- [ ] 文献或写作重点：",
    "- [ ] 哪个结果可以进入组会/论文主线：",
    "",
    "## 下周最小计划",
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

  lines.push("", "## 可展示证据", "");

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
        `  - 指标：${metricText}`,
        `  - 复现：${reproducibilityText(String(config.reproducibility ?? "unknown"))}；可写入论文/组会：${manuscriptReady}`,
        `  - 一句话结论：${result.notes?.trim() || "待补充"}`,
      );
    });
  } else {
    lines.push("- 暂无可展示结果证据。");
  }

  lines.push("", "## 实验/数据更新", "");

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

  lines.push("", "## 文献输入", "");

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

  lines.push("", "## 阻塞与事务提醒", "");

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
    "- [ ] 如果要发周报，删掉内部备注，只保留进展、问题和下周计划",
  );

  return lines.join("\n");
}

function meetingFeedbackMarker(scope: MeetingBriefScope, start: Date) {
  return `<!-- meeting-feedback:${scope}:${start.toISOString().slice(0, 10)} -->`;
}

function meetingFeedbackMarkdown({
  generatedAt,
  marker,
  period,
  meetingBrief,
  recentTasks,
  recentResults,
}: {
  generatedAt: Date;
  marker: string;
  period: ReturnType<typeof getMeetingBriefPeriod>;
  meetingBrief: { id: string; title: string; updatedAt: Date } | null;
  recentTasks: MeetingBriefTask[];
  recentResults: Array<Result & { experiment: (Experiment & { project: Project | null }) | null }>;
}) {
  const taskLines = recentTasks.length
    ? recentTasks.map((task) => {
        const owner = task.milestone
          ? `${task.milestone.project.title} / ${task.milestone.title}`
          : "独立任务";
        return `- ${task.title}（${owner}；${taskPriorityText(task.priority)}；${dateText(task.dueDate)}）`;
      })
    : ["- 暂无高优先级或临近任务。"];

  const resultLines = recentResults.length
    ? recentResults.map((result) => {
        const config = parseJsonObjectText(result.config);
        return [
          `- ${result.title}`,
          `  - 项目：${result.experiment?.project?.title ?? "未关联项目"}；实验：${result.experiment?.title ?? "未关联实验"}`,
          `  - 复现：${reproducibilityText(String(config.reproducibility ?? "unknown"))}；图表：${result.artifactPath || "待补"}`,
          `  - 结论：${result.notes?.trim() || "待补"}`,
        ].join("\n");
      })
    : ["- 暂无近期结果证据。"];

  return [
    marker,
    "",
    `# 导师反馈回填 ${period.shortLabel}`,
    "",
    `生成时间：${generatedAt.toLocaleString("zh-CN", { hour12: false })}`,
    "",
    "> 会后 5 分钟内先写下来。这里不是正式会议纪要，只负责把导师判断、风险和下一步收进可拆任务的笔记。",
    "",
    "## 本次沟通结论",
    "",
    "- 导师最认可的进展：",
    "- 导师最担心的问题：",
    "- 本周/下周必须交付的最小结果：",
    "- 暂时不要做或需要降级的方向：",
    "",
    "## 反馈原文 / 关键句",
    "",
    "- ",
    "",
    "## 需要立刻拆成任务",
    "",
    "- [ ] 按导师反馈补一个最小实验或对照",
    "- [ ] 把需要导师确认的问题整理成下次沟通清单",
    "- [ ] 更新相关结果证据或图表路径",
    "",
    "## 需要回填到平台的位置",
    "",
    "- [ ] 项目页：更新下一步任务和优先级",
    "- [ ] 实验页：补实验观察、失败原因或新对照",
    "- [ ] 成果页：补复现状态、图表路径或一句话结论",
    "- [ ] 文献页：把导师提到的文献加入 Zotero 或待读队列",
    "",
    "## 会前草稿",
    "",
    meetingBrief
      ? `- 已有关联草稿：${meetingBrief.title}（${dateText(meetingBrief.updatedAt)} 更新）`
      : "- 本周期还没有生成会前周报草稿。",
    "",
    "## 会前未完成任务参考",
    "",
    taskLines.join("\n"),
    "",
    "## 近期结果证据参考",
    "",
    resultLines.join("\n"),
    "",
    "## 下次沟通前检查",
    "",
    "- [ ] 上面的待办已用笔记页“拆成任务”同步到项目页",
    "- [ ] 需要导师判断的问题不超过 3 个",
    "- [ ] 有至少一条可展示结果或明确失败证据",
  ].join("\n");
}

function dailyPlanMarkdown({
  generatedAt,
  period,
  tasks,
  adminItems,
  experiments,
  results,
  papers,
}: {
  generatedAt: Date;
  period: ReturnType<typeof getDailyPlanPeriod>;
  tasks: DailyPlanTask[];
  adminItems: AdminItem[];
  experiments: DailyPlanExperiment[];
  results: DailyPlanResult[];
  papers: Paper[];
}) {
  const focusTasks = tasks.slice(0, 3);
  const followUps = [
    ...tasks.slice(3).map((task) => `- [ ] ${task.title}（${taskOwnerText(task)}）`),
    ...adminItems.map((item) => `- [ ] ${item.title}（${adminTypeText(item.type)}，${dateText(item.dueDate)}）`),
  ].slice(0, 8);

  const lines = [
    period.marker,
    "",
    `# ${period.title}`,
    "",
    `生成时间：${generatedAt.toLocaleString("zh-CN", { hour12: false })}`,
    "",
    "> 先选一件最重要的事开始。今天的目标是推进、留证据、写清下一步。",
    "",
    "## 今天最重要的三件事",
    "",
  ];

  if (focusTasks.length) {
    focusTasks.forEach((task, index) => {
      lines.push(
        `${index + 1}. [ ] ${task.title}`,
        `   - 归属：${taskOwnerText(task)}`,
        `   - 优先级：${taskPriorityText(task.priority)}；状态：${taskStatusText(task.status)}；截止：${dateText(task.dueDate)}`,
        task.description?.trim() ? `   - 备注：${oneLine(task.description, 100)}` : "",
      );
    });
  } else {
    lines.push("- [ ] 从项目页挑一个最小下一步，或用快速捕捉记录今天要做的事。");
  }

  lines.push("", "## 需要顺手收口", "");

  if (followUps.length) {
    lines.push(...followUps);
  } else {
    lines.push("- 暂无临近事务或额外任务。");
  }

  lines.push("", "## 实验和证据", "");

  if (experiments.length) {
    experiments.forEach((experiment) => {
      lines.push(
        `- ${experiment.title}`,
        `  - 项目：${experiment.project?.title ?? "未关联项目"}；结果数：${experiment.results.length}；最近更新：${dateText(experiment.updatedAt)}`,
        `  - 今天要补：观察 / 结论 / 下一步`,
      );
    });
  } else {
    lines.push("- 暂无进行中实验。");
  }

  lines.push("", "## 最近结果", "");

  if (results.length) {
    results.forEach((result) => {
      const config = parseJsonObjectText(result.config);
      const metrics = parseJsonObjectText(result.metrics);
      const metricText = Object.entries(metrics)
        .filter(([, value]) => String(value).trim())
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join("；") || "未填写指标";

      lines.push(
        `- ${result.title}`,
        `  - 项目：${result.experiment?.project?.title ?? "未关联项目"}；实验：${result.experiment?.title ?? "未关联实验"}`,
        `  - 指标：${metricText}；复现：${reproducibilityText(String(config.reproducibility ?? "unknown"))}`,
        `  - 今天要补：${result.artifactPath ? "确认图表/素材能用" : "补图表路径或一句话结论"}`,
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
      );
    });
  } else {
    lines.push("- 暂无待读或读中文献。");
  }

  lines.push(
    "",
    "## 晚上收口",
    "",
    "- [ ] 今天新增的实验是否写了结论和下一步",
    "- [ ] 今天读过的文献是否生成阅读笔记",
    "- [ ] 今天得到的结果是否能变成写作素材",
    "- [ ] 明天第一件事是否已经明确",
  );

  return lines.join("\n");
}

function closingReviewMarker(value: Date) {
  return `closing-review:${value.toISOString().slice(0, 10)}`;
}

function resultNeedsClosing(result: Result) {
  const config = parseJsonObjectText(result.config);
  return config.reproducibility !== "verified" || (!config.manuscriptReady && !result.artifactPath);
}

function closingReviewMarkdown({
  generatedAt,
  marker,
  overdueTasks,
  staleTasks,
  staleExperiments,
  results,
  stalePapers,
}: {
  generatedAt: Date;
  marker: string;
  overdueTasks: DailyPlanTask[];
  staleTasks: DailyPlanTask[];
  staleExperiments: DailyPlanExperiment[];
  results: DailyPlanResult[];
  stalePapers: Paper[];
}) {
  const lines = [
    `<!-- ${marker} -->`,
    "",
    `# 今日收口清单 ${generatedAt.toISOString().slice(0, 10)}`,
    "",
    `生成时间：${generatedAt.toLocaleString("zh-CN", { hour12: false })}`,
    "",
    "> 不新增管理负担。只把逾期、久未更新、待补证据和长期未处理文献收成一张当天可编辑清单。",
    "",
    "## 先处理：逾期任务",
    "",
  ];

  if (overdueTasks.length) {
    overdueTasks.forEach((task) => {
      lines.push(
        `- [ ] ${task.title}`,
        `  - 归属：${taskOwnerText(task)}；截止：${dateText(task.dueDate)}；优先级：${taskPriorityText(task.priority)}`,
        task.description?.trim() ? `  - 必要上下文：${oneLine(task.description, 120)}` : "",
      );
    });
  } else {
    lines.push("- 暂无逾期任务。");
  }

  lines.push("", "## 看一眼：久未更新任务", "");

  if (staleTasks.length) {
    staleTasks.forEach((task) => {
      lines.push(
        `- [ ] ${task.title}`,
        `  - 归属：${taskOwnerText(task)}；${dateText(task.updatedAt)} 后未更新`,
        "  - 今天只需判断：继续推进 / 改期 / 标记完成 / 拆成更小任务",
      );
    });
  } else {
    lines.push("- 暂无久未更新的进行中任务。");
  }

  lines.push("", "## 实验收口", "");

  if (staleExperiments.length) {
    staleExperiments.forEach((experiment) => {
      lines.push(
        `- [ ] ${experiment.title}`,
        `  - 项目：${experiment.project?.title ?? "未关联项目"}；结果数：${experiment.results.length}；${dateText(experiment.updatedAt)} 后未更新`,
        "  - 今天要补：观察 / 结论 / 下一步，必要时生成结果证据",
      );
    });
  } else {
    lines.push("- 暂无久未收口的进行中实验。");
  }

  lines.push("", "## 结果证据缺口", "");

  if (results.length) {
    results.forEach((result) => {
      const config = parseJsonObjectText(result.config);
      const need = [
        config.reproducibility === "verified" ? "" : "复现状态",
        result.artifactPath ? "" : "图表/结果路径",
        config.manuscriptReady ? "" : "写作素材判断",
      ].filter(Boolean).join("、") || "复核";

      lines.push(
        `- [ ] ${result.title}`,
        `  - 项目：${result.experiment?.project?.title ?? "未关联项目"}；实验：${result.experiment?.title ?? "未关联实验"}`,
        `  - 待补：${need}；数据集：${result.dataset?.name ?? "未关联数据集"}`,
        result.notes?.trim() ? `  - 当前结论：${oneLine(result.notes, 120)}` : "",
      );
    });
  } else {
    lines.push("- 暂无待补结果证据。");
  }

  lines.push("", "## 文献阅读尾巴", "");

  if (stalePapers.length) {
    stalePapers.forEach((paper) => {
      lines.push(
        `- [ ] ${paper.title}`,
        `  - 状态：${paperStatusText(paper.readStatus)}；来源：${paper.journal || paper.category || "未填写"}；${dateText(paper.updatedAt)} 后未更新`,
        "  - 今天只需判断：继续读 / 转任务 / 转实验 / 标记已读",
      );
    });
  } else {
    lines.push("- 暂无长期未处理的待读/读中文献。");
  }

  lines.push(
    "",
    "## 今天收口原则",
    "",
    "- [ ] 每类最多处理 1-2 项，避免把收口变成新的工作量",
    "- [ ] 能改状态就改状态，能生成任务就生成任务，不能处理就写明原因",
    "- [ ] 处理完后回到今日计划或项目页，只推进一个最小下一步",
  );

  return lines.join("\n");
}

function firstRunGuideMarker() {
  return "first-run-guide:v1";
}

function firstRunGuideMarkdown(generatedAt: Date, marker: string) {
  return [
    `<!-- ${marker} -->`,
    "",
    "# 研途 Hub 10 分钟上手清单",
    "",
    `生成时间：${generatedAt.toLocaleString("zh-CN", { hour12: false })}`,
    "",
    "> 第一天不要迁移历史资料，也不要研究所有设置。只让工作台开始接住你的真实科研流。",
    "",
    "## 0. 今天的原则",
    "",
    "- [ ] 只放当前正在推进的课题，不搬旧项目",
    "- [ ] 只同步或补录正在读的文献，不整理全部 PDF",
    "- [ ] 只写第一条能复盘的实验、笔记或组会提醒",
    "- [ ] 配置只处理 Zotero、AI Key 和访问密码这些常改项",
    "",
    "## 1. 连接文献源",
    "",
    "- [ ] 到设置中心填写 Zotero API Key、Library ID 和同步数量",
    "- [ ] 到文献页点击同步 Zotero",
    "- [ ] 把最要读的 3 篇标成“读中”或“待读”",
    "- [ ] 从当前列表生成一篇阅读计划",
    "",
    "## 2. 建一个真实课题",
    "",
    "- [ ] 到课题页创建当前正在推进的课题",
    "- [ ] 写一句话目标：我想验证什么，近期交付物是什么",
    "- [ ] 创建 1 个里程碑",
    "- [ ] 创建 1-3 个下一步任务，优先写今天或本周能推进的动作",
    "",
    "## 3. 留下第一条研究记录",
    "",
    "- [ ] 如果今天做实验：到实验页写目的、方法、观察、结论、下一步",
    "- [ ] 如果今天读文献：到文献页生成阅读笔记",
    "- [ ] 如果今天要组会：到事务页生成周报草稿",
    "- [ ] 如果只是一个想法：在顶部快速捕捉里直接写一句话",
    "",
    "## 4. 晚上收口",
    "",
    "- [ ] 首页是否能显示今天最该推进的事",
    "- [ ] 有没有一条实验、文献或笔记能复盘",
    "- [ ] 明天第一件事是否已经写成任务",
    "- [ ] 哪些资料暂时不用迁移",
    "",
    "## 暂时不要做",
    "",
    "- 不要把 Zotero 里所有 PDF 搬进平台",
    "- 不要把旧实验日志一次性补完",
    "- 不要为每个项目填很多字段",
    "- 不要把 AI 输出当最终结论；它只负责草稿和结构",
  ].join("\n");
}

function taskOwnerText(task: DailyPlanTask | MeetingBriefTask) {
  return task.milestone
    ? `${task.milestone.project.title} / ${task.milestone.title}`
    : "独立任务";
}

function taskRank(task: Pick<Task, "dueDate" | "priority" | "status" | "updatedAt">) {
  const due = task.dueDate ? task.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
  const priority = { high: 0, medium: 1, low: 2 }[task.priority] ?? 3;
  const status = task.status === "doing" ? -1 : 0;

  return due + priority * 86_400_000 + status * 43_200_000 - task.updatedAt.getTime() / 1_000_000;
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
