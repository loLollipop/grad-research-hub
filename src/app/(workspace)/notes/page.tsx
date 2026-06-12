import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Beaker,
  BookOpenText,
  Clock3,
  FileText,
  FolderOpen,
  Link2,
  ListTodo,
  MessageSquareText,
  NotebookPen,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { Note, Prisma } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  createNote,
  createNoteCloseoutNote,
  createTasksFromNoteChecklist,
  createWritingPackNote,
  deleteNote,
  updateNote,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { extractWikiLinks, formatDateTime, parseTags } from "@/lib/format";
import { getWritingPackPeriod } from "@/lib/writing-pack";
import { cn } from "@/lib/utils";
import { CaptureNotice } from "@/components/shared/capture-notice";
import { Field } from "@/components/shared/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    focus?: string;
    folder?: string;
    mode?: string;
    note?: string;
    q?: string;
    source?: string;
    taskSync?: string;
    captured?: string;
  }>;
};

type NoteFocus = "inbox" | "links" | "tasks" | "writing";
type NoteSource = "reading" | "experiment" | "meeting" | "result" | "writing";
type WritingMaterialTone = "reading" | "experiment" | "result" | "meeting" | "writing";

type WritingMaterialSignal = {
  action: string;
  count: number;
  detail: string;
  href: string;
  icon: LucideIcon;
  label: string;
  tone: WritingMaterialTone;
};

type InboxTriageSignal = {
  action: string;
  count: number;
  detail: string;
  href: string;
  icon: LucideIcon;
  label: string;
  tone: "inbox" | "link" | "task" | "writing";
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseNoteFocus(value: string | undefined): NoteFocus | undefined {
  if (value === "inbox" || value === "links" || value === "tasks" || value === "writing") {
    return value;
  }

  return undefined;
}

function parseNoteSource(value: string | undefined): NoteSource | undefined {
  if (
    value === "reading" ||
    value === "experiment" ||
    value === "meeting" ||
    value === "result" ||
    value === "writing"
  ) {
    return value;
  }

  return undefined;
}

function folderLabel(value: string | null | undefined) {
  if (!value || value === "Inbox") {
    return "收件箱";
  }

  return value;
}

function noteSnippet(content: string) {
  return content
    .replace(/[#*_`>\-[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 78);
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function uniqueWikiLinks(content: string) {
  return [...new Set(extractWikiLinks(content).map((link) => link.trim()).filter(Boolean))];
}

function openChecklistCount(content: string) {
  return content
    .split("\n")
    .filter((line) => /^\s*[-*]\s+\[\s\]\s+.+/.test(line))
    .filter((line) => !content.includes(noteTaskMarkerKey(line)))
    .length;
}

function noteTaskMarkerKey(line: string) {
  const title = line
    .replace(/^\s*[-*]\s+\[\s\]\s+/, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
  let hash = 0;
  for (let index = 0; index < title.length; index += 1) {
    hash = (hash * 31 + title.charCodeAt(index)) >>> 0;
  }
  return `:${hash.toString(36)} -->`;
}

const writingFolders = ["组会", "阅读", "实验", "结果", "写作"];

function isWritingMaterial(note: Note) {
  return writingFolders.some((name) => note.folder.includes(name));
}

function noteActionLabel(note: Note, allNotes: Note[]) {
  const checklist = openChecklistCount(note.content);
  const links = uniqueWikiLinks(note.content);
  const allTitles = new Set(allNotes.map((item) => normalizeTitle(item.title)));
  const missingLinkCount = links.filter((link) => !allTitles.has(normalizeTitle(link))).length;

  if (checklist > 0) {
    return "拆任务";
  }

  if (missingLinkCount > 0) {
    return "补双链";
  }

  if (isWritingMaterial(note)) {
    return "继续打磨";
  }

  if (links.length > 0) {
    return "回顾关系";
  }

  return "继续写";
}

function noteActionReason(note: Note, allNotes: Note[]) {
  const checklist = openChecklistCount(note.content);
  const links = uniqueWikiLinks(note.content);
  const allTitles = new Set(allNotes.map((item) => normalizeTitle(item.title)));
  const missingLinkCount = links.filter((link) => !allTitles.has(normalizeTitle(link))).length;

  if (checklist > 0) {
    return "待拆任务";
  }

  if (missingLinkCount > 0) {
    return "补双链";
  }

  if (isWritingMaterial(note)) {
    return "可写作";
  }

  if (links.length > 0) {
    return "有关联";
  }

  return "继续补";
}

function noteActionScore(note: Note, allNotes: Note[]) {
  const ageHours = Math.max(1, (Date.now() - note.updatedAt.getTime()) / 36e5);
  const recency = 1 / ageHours;
  const checklist = openChecklistCount(note.content);
  const links = uniqueWikiLinks(note.content);
  const allTitles = new Set(allNotes.map((item) => normalizeTitle(item.title)));
  const missingLinkCount = links.filter((link) => !allTitles.has(normalizeTitle(link))).length;

  return recency + checklist * 5 + missingLinkCount * 2 + links.length + (isWritingMaterial(note) ? 1.5 : 0);
}

function noteMatchesFocus(note: Note, focus: NoteFocus, titleMap: Map<string, Note>) {
  if (focus === "tasks") {
    return openChecklistCount(note.content) > 0;
  }

  if (focus === "links") {
    return uniqueWikiLinks(note.content).some((link) => !titleMap.has(normalizeTitle(link)));
  }

  if (focus === "writing") {
    return isWritingMaterial(note);
  }

  return !note.folder || note.folder === "Inbox";
}

const sourceKeywordMap: Record<NoteSource, { metadata: string[]; content: string[] }> = {
  reading: {
    metadata: ["阅读", "文献", "论文摘录", "zotero", "paper", "literature"],
    content: ["阅读问题", "文献", "zotero", "paper"],
  },
  experiment: {
    metadata: ["实验", "复盘", "对照", "消融", "experiment"],
    content: ["实验目的", "实验观察", "实验结论", "对照", "消融", "复现步骤"],
  },
  meeting: {
    metadata: ["组会", "周报", "导师", "反馈", "meeting"],
    content: ["导师反馈", "本周进展", "下周计划", "组会", "周报"],
  },
  result: {
    metadata: ["结果", "成果", "证据", "数据", "复现", "指标", "result", "dataset"],
    content: ["核心指标", "复现状态", "图表路径", "结果证据", "数据来源"],
  },
  writing: {
    metadata: ["写作", "论文草稿", "素材包", "manuscript", "draft", "related work"],
    content: ["写作素材", "论文段落", "related work", "introduction", "manuscript"],
  },
};

const noteSourceFilters: Array<{
  key: NoteSource;
  label: string;
  detail: string;
  icon: LucideIcon;
}> = [
  { key: "reading", label: "阅读", detail: "论文摘录 / 阅读计划", icon: BookOpenText },
  { key: "experiment", label: "实验", detail: "实验复盘 / 观察", icon: Beaker },
  { key: "meeting", label: "组会", detail: "周报 / 导师反馈", icon: MessageSquareText },
  { key: "result", label: "结果", detail: "证据 / 复现清单", icon: BarChart3 },
  { key: "writing", label: "写作", detail: "论文素材 / 草稿", icon: PenLine },
];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function noteMatchesSource(note: Note, source: NoteSource) {
  const keywords = sourceKeywordMap[source];
  const metadata = `${note.folder} ${note.title} ${note.tags}`.toLowerCase();
  const content = note.content.toLowerCase();

  return includesAny(metadata, keywords.metadata) || includesAny(content, keywords.content);
}

function notesHref({
  focus,
  folder,
  note,
  q,
  source,
}: {
  focus?: NoteFocus;
  folder?: string;
  note?: string;
  q?: string;
  source?: NoteSource;
}) {
  const query = new URLSearchParams();
  if (focus) query.set("focus", focus);
  if (source) query.set("source", source);
  if (folder) query.set("folder", folder);
  if (q) query.set("q", q);
  if (note) query.set("note", note);

  return query.size ? `/notes?${query.toString()}` : "/notes";
}

function noteFocusLabel(focus?: NoteFocus) {
  const labels: Record<NoteFocus, string> = {
    inbox: "收件箱",
    links: "待补双链",
    tasks: "可拆任务",
    writing: "写作素材",
  };

  return focus ? labels[focus] : "最近笔记";
}

function noteSourceLabel(source?: NoteSource) {
  const labels: Record<NoteSource, string> = {
    reading: "阅读材料",
    experiment: "实验复盘",
    meeting: "组会周报",
    result: "结果证据",
    writing: "写作素材",
  };

  return source ? labels[source] : undefined;
}

export default async function NotesPage({ searchParams }: Props) {
  const params = await searchParams;
  const focus = parseNoteFocus(first(params.focus));
  const source = parseNoteSource(first(params.source));
  const q = first(params.q)?.trim();
  const folder = first(params.folder)?.trim();
  const mode = first(params.mode);
  const noteId = first(params.note);
  const taskSync = first(params.taskSync);
  const captured = first(params.captured);
  const writingPackPeriod = getWritingPackPeriod();

  const noteWhere: Prisma.NoteWhereInput = {};
  if (q) {
    noteWhere.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
      { tags: { contains: q, mode: "insensitive" } },
    ];
  }
  if (folder) {
    noteWhere.folder = { contains: folder, mode: "insensitive" };
  }
  const [notes, allNotes, folders, currentWritingPack] = await Promise.all([
    prisma.note.findMany({
      where: noteWhere,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.note.findMany({
      orderBy: { updatedAt: "desc" },
    }),
    prisma.note.groupBy({
      by: ["folder"],
      _count: true,
      orderBy: { folder: "asc" },
    }),
    prisma.note.findFirst({
      where: {
        folder: "写作",
        content: { contains: writingPackPeriod.marker, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, updatedAt: true },
    }),
  ]);
  const noteTitleMap = new Map<string, Note>();
  allNotes.forEach((note) => {
    const title = normalizeTitle(note.title);
    if (!noteTitleMap.has(title)) {
      noteTitleMap.set(title, note);
    }
  });
  const focusFilteredNotes = focus
    ? notes.filter((note) => noteMatchesFocus(note, focus, noteTitleMap))
    : notes;
  const visibleNotes = source
    ? focusFilteredNotes.filter((note) => noteMatchesSource(note, source))
    : focusFilteredNotes;
  const totalNotes = allNotes.length;
  const selectedNote = noteId
    ? allNotes.find((note) => note.id === noteId)
    : visibleNotes[0];
  const activeNote = mode === "new" ? undefined : selectedNote;
  const activeLinks = activeNote ? uniqueWikiLinks(activeNote.content) : [];
  const defaultFolder = folder || "Inbox";
  const linkedNotes = activeLinks
    .map((link) => noteTitleMap.get(normalizeTitle(link)))
    .filter((note): note is Note => Boolean(note));
  const missingLinks = activeLinks.filter((link) => !noteTitleMap.has(normalizeTitle(link)));
  const backlinkNotes = activeNote
    ? allNotes.filter(
        (note) =>
          note.id !== activeNote.id &&
          uniqueWikiLinks(note.content).some(
            (link) => normalizeTitle(link) === normalizeTitle(activeNote.title),
          ),
      )
    : [];
  const checklistCount = activeNote ? openChecklistCount(activeNote.content) : 0;
  const noteStack = allNotes
    .map((note) => ({
      note,
      action: noteActionLabel(note, allNotes),
      score: noteActionScore(note, allNotes),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
  const notesWithTasks = allNotes.filter((note) => openChecklistCount(note.content) > 0).length;
  const linkedNoteCount = allNotes.filter((note) => uniqueWikiLinks(note.content).length > 0).length;
  const writingNoteCount = allNotes.filter(isWritingMaterial).length;
  const missingLinkNoteCount = allNotes.filter((note) =>
    uniqueWikiLinks(note.content).some((link) => !noteTitleMap.has(normalizeTitle(link))),
  ).length;
  const inboxNoteCount = allNotes.filter((note) => !note.folder || note.folder === "Inbox").length;
  const triageNotes = allNotes
    .filter((note) => {
      const checklist = openChecklistCount(note.content);
      const links = uniqueWikiLinks(note.content);
      const missingLinkCount = links.filter((link) => !noteTitleMap.has(normalizeTitle(link))).length;
      return !note.folder || note.folder === "Inbox" || checklist > 0 || missingLinkCount > 0 || isWritingMaterial(note);
    })
    .map((note) => ({
      note,
      action: noteActionLabel(note, allNotes),
      score: noteActionScore(note, allNotes),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
  const inboxTriageSignals: InboxTriageSignal[] = [
    {
      action: "清理收件箱",
      count: inboxNoteCount,
      detail: "临时想法、导师口头反馈和实验碎片，先补分类和标签。",
      href: notesHref({ focus: "inbox" }),
      icon: FolderOpen,
      label: "待归档",
      tone: "inbox",
    },
    {
      action: "拆回任务",
      count: notesWithTasks,
      detail: "把笔记里的 checklist 拆到课题任务，避免待办埋在正文里。",
      href: notesHref({ focus: "tasks" }),
      icon: ListTodo,
      label: "可拆任务",
      tone: "task",
    },
    {
      action: "补齐主题",
      count: missingLinkNoteCount,
      detail: "双链未创建会让阅读、实验和写作上下文断开。",
      href: notesHref({ focus: "links" }),
      icon: Link2,
      label: "待补双链",
      tone: "link",
    },
    {
      action: "沉淀写作",
      count: writingNoteCount,
      detail: "把组会、阅读、实验和结果沉成周报或论文素材。",
      href: notesHref({ focus: "writing" }),
      icon: FileText,
      label: "写作素材",
      tone: "writing",
    },
  ];
  const sourceCounts: Record<NoteSource, number> = {
    reading: allNotes.filter((note) => noteMatchesSource(note, "reading")).length,
    experiment: allNotes.filter((note) => noteMatchesSource(note, "experiment")).length,
    meeting: allNotes.filter((note) => noteMatchesSource(note, "meeting")).length,
    result: allNotes.filter((note) => noteMatchesSource(note, "result")).length,
    writing: allNotes.filter((note) => noteMatchesSource(note, "writing")).length,
  };
  const writingSignals: WritingMaterialSignal[] = [
    {
      action: "筛选阅读摘录",
      count: sourceCounts.reading,
      detail: "Zotero 阅读、论文摘录和 related work 线索。",
      href: notesHref({ source: "reading" }),
      icon: BookOpenText,
      label: "阅读材料",
      tone: "reading",
    },
    {
      action: "查看实验复盘",
      count: sourceCounts.experiment,
      detail: "实验目的、观察、失败原因和下一步验证。",
      href: notesHref({ source: "experiment" }),
      icon: Beaker,
      label: "实验复盘",
      tone: "experiment",
    },
    {
      action: "收束结果证据",
      count: sourceCounts.result,
      detail: "指标、图表路径、复现状态和可讲结论。",
      href: notesHref({ source: "result" }),
      icon: BarChart3,
      label: "结果证据",
      tone: "result",
    },
    {
      action: "回看组会反馈",
      count: sourceCounts.meeting,
      detail: "导师判断、组会问题和周报口径。",
      href: notesHref({ source: "meeting" }),
      icon: MessageSquareText,
      label: "组会反馈",
      tone: "meeting",
    },
    {
      action: currentWritingPack ? "打开素材包" : "筛选写作草稿",
      count: sourceCounts.writing,
      detail: "周报、论文段落、提纲和本周写作素材包。",
      href: currentWritingPack ? notesHref({ note: currentWritingPack.id }) : notesHref({ source: "writing" }),
      icon: PenLine,
      label: "写作草稿",
      tone: "writing",
    },
  ];
  const listLabel = source
    ? `${noteFocusLabel(focus)} · ${noteSourceLabel(source)}`
    : noteFocusLabel(focus);

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-4 shadow-[0_18px_48px_rgba(27,42,56,0.06)] md:px-6">
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="research-eyebrow">
                <NotebookPen className="size-3.5" />
                笔记工作室
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                阅读 · 实验 · 组会 · 论文素材
              </span>
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.35rem]">
              先写材料，再整理关系。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              左侧找材料，右侧专心写。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {activeNote ? (
                <Button render={<Link href={`#note-${activeNote.id}`} />} className="bg-primary">
                  <PenLine className="size-4" />
                  继续当前笔记
                </Button>
              ) : null}
              <Button render={<Link href="/notes?mode=new" />} variant={activeNote ? "outline" : "default"}>
                <Plus className="size-4" />
                写新笔记
              </Button>
              {currentWritingPack ? (
                <Link className={buttonVariants({ variant: "outline" })} href={`/notes?note=${currentWritingPack.id}`}>
                  <FileText className="size-4" />
                  打开素材包
                </Link>
              ) : (
                <form action={createWritingPackNote}>
                  <SubmitButton variant="outline">
                    <FileText className="size-4" />
                    生成写作素材包
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>

          <div className="flex min-h-52 flex-col justify-between rounded-2xl action-stack p-4 text-white shadow-[0_16px_32px_rgba(22,34,53,0.14)]">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-medium text-white/68">
                  <BookOpenText className="size-3.5" />
                  今日沉淀栈
                </p>
                {noteStack.length ? (
                  <form action={createNoteCloseoutNote}>
                    {noteStack.map(({ note }) => (
                      <input key={note.id} type="hidden" name="ids" value={note.id} />
                    ))}
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="h-7 border-white/16 bg-white/10 px-2 text-[11px] text-white hover:bg-white/16 hover:text-white"
                    >
                      生成清单
                    </Button>
                  </form>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2">
                {noteStack.length ? (
                  noteStack.map(({ note, action }, index) => (
                    <NoteStackItem
                      key={note.id}
                      index={`0${index + 1}`}
                      title={note.title}
                      detail={`${action} · ${folderLabel(note.folder)}`}
                    />
                  ))
                ) : (
                  <NoteStackItem
                    index="01"
                    title="先写一篇今天能继续用的笔记"
                    detail="组会、阅读、实验或结果都可以"
                  />
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
              <div>
                <p className="text-lg font-semibold tracking-tight">{notesWithTasks}</p>
                <p className="mt-0.5 text-[11px] text-white/54">可拆任务</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{linkedNoteCount}</p>
                <p className="mt-0.5 text-[11px] text-white/54">含双链</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{writingNoteCount}</p>
                <p className="mt-0.5 text-[11px] text-white/54">写作素材</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <InboxTriageBoard signals={inboxTriageSignals} triageNotes={triageNotes} />

      <WritingMaterialBoard currentWritingPack={currentWritingPack} signals={writingSignals} />

      <section className="grid flex-1 gap-4 lg:h-[calc(100dvh-19rem)] lg:min-h-[760px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="workbench-card flex min-h-[560px] flex-col overflow-hidden rounded-2xl border bg-white/95 py-0 lg:min-h-0">
          <div className="border-b border-border/75 bg-[linear-gradient(135deg,rgba(240,247,247,0.92),rgba(255,250,238,0.72))] p-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/82 text-primary shadow-sm">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#173042]">
                  {currentWritingPack ? "今天的写作素材包已生成" : "写论文或周报前先收一次材料"}
                </p>
                <p className="sr-only">
                  {currentWritingPack
                    ? `更新 ${formatDateTime(currentWritingPack.updatedAt)}，可以继续编辑，不会重复创建。`
                    : "自动汇总可写入结果、读中文献和最近笔记，生成后仍在右侧编辑。"}
                </p>
              </div>
            </div>
          </div>
          <QuickNoteCapture />
          <div className="border-b border-border/75 bg-white/70 p-3.5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" />
              整理视角
            </div>
            <div className="grid gap-2">
              <NoteRadarItem
                icon={ListTodo}
                label="可拆任务"
                value={`${notesWithTasks} 篇`}
                detail="把笔记里的待办清单拆回课题任务"
                href={notesHref({ focus: "tasks", folder, q, source })}
                active={focus === "tasks"}
                tone={notesWithTasks ? "blue" : "quiet"}
              />
              <NoteRadarItem
                icon={Link2}
                label="待补双链"
                value={`${missingLinkNoteCount} 篇`}
                detail="未创建主题会让阅读、实验和写作上下文断开"
                href={notesHref({ focus: "links", folder, q, source })}
                active={focus === "links"}
                tone={missingLinkNoteCount ? "warm" : "quiet"}
              />
              <NoteRadarItem
                icon={FileText}
                label="写作素材"
                value={`${writingNoteCount} 篇`}
                detail="可进入组会、周报或论文草稿"
                href={notesHref({ focus: "writing", folder, q, source })}
                active={focus === "writing"}
                tone={writingNoteCount ? "green" : "quiet"}
              />
              <NoteRadarItem
                icon={FolderOpen}
                label="收件箱"
                value={`${inboxNoteCount} 篇`}
                detail="临时想法先收住，之后再归档"
                href={notesHref({ focus: "inbox", folder, q, source })}
                active={focus === "inbox"}
                tone={inboxNoteCount ? "warm" : "quiet"}
              />
            </div>
          </div>
          <div className="border-b border-border/75 bg-white/60 p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BookOpenText className="size-4 text-primary" />
                材料来源
              </div>
              {source ? (
                <Link
                  href={notesHref({ focus, folder, q })}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  清除来源
                </Link>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {noteSourceFilters.map((item) => (
                <NoteSourceChip
                  key={item.key}
                  active={source === item.key}
                  count={sourceCounts[item.key]}
                  detail={item.detail}
                  href={notesHref({ focus, folder, q, source: item.key })}
                  icon={item.icon}
                  label={item.label}
                />
              ))}
            </div>
          </div>
          <div className="border-b border-border/75 bg-white/60 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Search className="size-4 text-primary" />
                检索笔记
              </div>
              <span className="rounded-full border bg-white px-2 py-0.5 text-xs text-muted-foreground">
                {visibleNotes.length} / {totalNotes}
              </span>
            </div>
            <form className="mt-3 grid gap-2">
              {focus ? <input type="hidden" name="focus" value={focus} /> : null}
              {source ? <input type="hidden" name="source" value={source} /> : null}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="搜索标题、正文、标签"
                  defaultValue={q}
                  className="h-9 pl-8"
                />
              </div>
              <Input name="folder" placeholder="分类，例如 组会 / 阅读 / 想法" defaultValue={folder} className="h-9" />
              <Button type="submit" variant="outline" className="h-9 bg-white">
                筛选
              </Button>
            </form>
          </div>

          <div className="border-b border-border/75 p-3.5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FolderOpen className="size-4 text-primary" />
              分类
            </div>
            <div className="grid max-h-40 gap-1 overflow-y-auto pr-1 text-sm">
              <Link
                href={notesHref({ focus, q, source })}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2.5 py-2 transition hover:bg-muted/60",
                  !folder && "bg-primary/9 text-primary ring-1 ring-primary/18",
                )}
              >
                <span>全部笔记</span>
                <span className="text-xs text-muted-foreground">{totalNotes}</span>
              </Link>
              {folders.map((item) => {
                const selected = folder === item.folder;

                return (
                  <Link
                    key={item.folder}
                    href={notesHref({ focus, folder: item.folder, q, source })}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-2 transition hover:bg-muted/60",
                      selected && "bg-primary/9 text-primary ring-1 ring-primary/18",
                    )}
                  >
                    <span className="truncate">{folderLabel(item.folder)}</span>
                    <span className="text-xs text-muted-foreground">{item._count}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-3.5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="size-4 text-primary" />
                {listLabel}
              </div>
              {q || folder || focus || source ? (
                <Button render={<Link href="/notes" />} variant="ghost" size="sm">
                  清除
                </Button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3.5">
              {visibleNotes.length ? (
                <div className="grid gap-2">
                  {visibleNotes.map((note) => {
                    const selected = activeNote?.id === note.id;
                    const snippet = noteSnippet(note.content);
                    const action = noteActionLabel(note, allNotes);
                    const actionReason = noteActionReason(note, allNotes);

                    return (
                      <Link
                        key={note.id}
                        href={notesHref({ focus, folder, note: note.id, q, source })}
                        className={cn(
                          "rounded-xl border border-border/75 bg-white/72 px-3 py-2.5 text-sm transition hover:border-primary/25 hover:bg-white",
                          selected && "border-[#b8d7cf] bg-[#eef8f5] shadow-[0_8px_20px_rgba(45,97,84,0.08)]",
                        )}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="line-clamp-1 font-medium">{note.title}</span>
                          <span className="shrink-0 rounded-md border border-[#d8e5ee] bg-[#eef4fb] px-1.5 py-0.5 text-[11px] text-[#365a7d]">
                            {action}
                          </span>
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FolderOpen className="size-3" />
                          {folderLabel(note.folder)}
                          <span>·</span>
                          {formatDateTime(note.updatedAt)}
                        </span>
                        {snippet ? (
                          <span className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {snippet}
                          </span>
                        ) : null}
                        <span className="mt-2 inline-flex rounded-lg border border-[#d5e4e8] bg-[#f5fafb] px-2.5 py-1 text-xs leading-5 text-muted-foreground">
                          {actionReason}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-5 text-center">
                  <NotebookPen className="mb-2 size-7 text-muted-foreground" />
                  <p className="text-sm font-medium">暂无匹配笔记</p>
                  <p className="sr-only">
                    换个关键词，或者直接新建一篇。
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <section
          id={activeNote ? `note-${activeNote.id}` : "new-note"}
          className="workbench-card flex min-h-[720px] flex-col overflow-hidden rounded-2xl border bg-[#fffefa] py-0 lg:min-h-0"
        >
          <CaptureNotice kind={captured} />

          <div className="grid gap-3 border-b border-border/75 bg-[linear-gradient(135deg,rgba(255,254,249,0.95),rgba(248,250,242,0.82))] px-4 py-3.5 md:grid-cols-[1fr_auto] md:items-start">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FileText className="size-3.5 text-primary" />
                {activeNote
                  ? `${folderLabel(activeNote.folder)} · 更新 ${formatDateTime(activeNote.updatedAt)}`
                  : "新笔记"}
              </div>
              <h2 className="truncate text-lg font-semibold tracking-tight">
                {activeNote ? activeNote.title : "先写材料，后面再整理"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeNote ? <TagList value={activeNote.tags} /> : null}
              {activeNote ? (
                <form action={createTasksFromNoteChecklist}>
                  <input type="hidden" name="id" value={activeNote.id} />
                  <SubmitButton
                    variant={checklistCount ? "outline" : "ghost"}
                    size="sm"
                    disabled={!checklistCount}
                  >
                    <ListTodo className="size-3.5" />
                    {checklistCount ? `拆成任务 ${checklistCount}` : "无待办清单"}
                  </SubmitButton>
                </form>
              ) : null}
              {activeNote ? (
                <form action={deleteNote}>
                  <input type="hidden" name="id" value={activeNote.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    <Trash2 className="size-3.5" />
                    删除
                  </Button>
                </form>
              ) : null}
            </div>
          </div>

          <Tabs defaultValue="edit" className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="flex flex-col gap-2 border-b border-border/75 bg-[#fffefa] px-4 py-2.5 md:flex-row md:items-center md:justify-between">
              <TabsList className="h-8 bg-muted/70">
                <TabsTrigger value="edit">编辑</TabsTrigger>
                <TabsTrigger value="preview">预览</TabsTrigger>
                <TabsTrigger value="links">双链</TabsTrigger>
              </TabsList>
              <p className="sr-only">
                {taskSync === "empty"
                  ? "没有新的未同步待办清单。"
                  : "支持 Markdown、`[[双链标题]]` 和 `- [ ] 待办清单`"}
              </p>
            </div>

            <TabsContent value="edit" className="min-h-0 flex-1 p-0">
              <NoteForm
                action={activeNote ? updateNote : createNote}
                note={activeNote}
                defaultFolder={defaultFolder}
              />
            </TabsContent>

            <TabsContent
              value="preview"
              className="min-h-0 flex-1 overflow-y-auto bg-[#f8f7ef] p-4 md:p-6"
            >
              <article className="mx-auto min-h-full max-w-4xl rounded-2xl border border-border/72 bg-white px-5 py-5 text-sm leading-7 shadow-[0_10px_28px_rgba(27,42,56,0.045)] md:px-7">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeNote?.content || "暂无预览"}
                </ReactMarkdown>
              </article>
            </TabsContent>

            <TabsContent value="links" className="min-h-0 flex-1 overflow-y-auto bg-[#f8f7ef] p-4 md:p-5">
              <div className="grid min-h-full gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="grid content-start gap-4">
                  <div className="rounded-2xl border border-border/72 bg-white p-5 shadow-[0_10px_24px_rgba(27,42,56,0.035)]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-medium">
                        <Link2 className="size-4 text-primary" />
                        当前笔记引用
                      </div>
                      <span className="rounded-full border bg-[#f6f8fb] px-2 py-0.5 text-xs text-muted-foreground">
                        {activeLinks.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeLinks.length ? (
                        activeLinks.map((link) => {
                          const matched = noteTitleMap.has(normalizeTitle(link));

                          return (
                            <span
                              key={link}
                              className={cn(
                                "rounded-lg border px-2.5 py-1 text-sm",
                                matched
                                  ? "border-[#c9e5e1] bg-[#eef7f7] text-[#315266]"
                                  : "border-[#efd9a8] bg-[#fff8e7] text-[#7a5a17]",
                              )}
                            >
                              [[{link}]]
                            </span>
                          );
                        })
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/72 bg-white p-5 shadow-[0_10px_24px_rgba(27,42,56,0.035)]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-medium">
                        <Sparkles className="size-4 text-primary" />
                        未创建链接
                      </div>
                      <span className="rounded-full border bg-[#f6f8fb] px-2 py-0.5 text-xs text-muted-foreground">
                        {missingLinks.length}
                      </span>
                    </div>
                    {missingLinks.length ? (
                      <div className="flex flex-wrap gap-2">
                        {missingLinks.map((link) => (
                          <span
                            key={link}
                            className="rounded-lg border border-[#efd9a8] bg-[#fff8e7] px-2.5 py-1 text-sm text-[#7a5a17]"
                          >
                            {link}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid content-start gap-4 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div className="rounded-2xl border border-border/72 bg-white p-5 shadow-[0_10px_24px_rgba(27,42,56,0.035)]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-medium">
                        <Sparkles className="size-4 text-primary" />
                        已匹配到的笔记
                      </div>
                      <span className="rounded-full border bg-[#f6f8fb] px-2 py-0.5 text-xs text-muted-foreground">
                        {linkedNotes.length}
                      </span>
                    </div>
                    {linkedNotes.length ? (
                      <div className="grid gap-2">
                        {linkedNotes.map((note) => (
                          <Link
                            key={note.id}
                            href={`/notes?note=${note.id}`}
                            className="grid gap-1 soft-tile rounded-xl p-3 transition hover:border-primary/25 hover:bg-white"
                          >
                            <span className="line-clamp-1 font-medium">{note.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {folderLabel(note.folder)} · {formatDateTime(note.updatedAt)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-border/72 bg-white p-5 shadow-[0_10px_24px_rgba(27,42,56,0.035)]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-medium">
                        <Link2 className="size-4 text-primary" />
                        反向链接
                      </div>
                      <span className="rounded-full border bg-[#f6f8fb] px-2 py-0.5 text-xs text-muted-foreground">
                        {backlinkNotes.length}
                      </span>
                    </div>
                    {backlinkNotes.length ? (
                      <div className="grid gap-2">
                        {backlinkNotes.map((note) => (
                          <Link
                            key={note.id}
                            href={`/notes?note=${note.id}`}
                            className="grid gap-1 soft-tile rounded-xl p-3 transition hover:border-primary/25 hover:bg-white"
                          >
                            <span className="line-clamp-1 font-medium">{note.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {folderLabel(note.folder)} · {formatDateTime(note.updatedAt)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </section>
    </div>
  );
}

function WritingMaterialBoard({
  currentWritingPack,
  signals,
}: {
  currentWritingPack: { id: string; updatedAt: Date } | null;
  signals: WritingMaterialSignal[];
}) {
  const totalMaterials = signals.reduce((sum, signal) => sum + signal.count, 0);
  const strongestSignal = signals.reduce((current, signal) =>
    signal.count > current.count ? signal : current,
  );

  return (
    <section className="writing-board overflow-hidden rounded-3xl border border-border/60 p-4 shadow-[0_18px_42px_rgba(27,42,56,0.052)]">
      <div className="grid gap-4 xl:grid-cols-[0.31fr_0.69fr] xl:items-stretch">
        <div className="writing-board-lead rounded-2xl border border-white/70 p-4">
          <span className="research-eyebrow">
            <FileText className="size-3.5" />
            写作材料板
          </span>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight hero-title">
            写周报、组会和论文前，先把材料收成一桌。
          </h2>
          <p className="mt-3 text-sm leading-6 hero-copy">
            不复制 Obsidian 的完整知识库，也不让你手动翻五个页面。阅读、实验、结果和导师反馈会按来源收束，
            需要时生成一篇可继续编辑的素材包。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">当前可用材料</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{totalMaterials}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">最厚来源</p>
              <p className="mt-1 truncate text-base font-semibold hero-title">
                {strongestSignal.count ? strongestSignal.label : "先沉淀一条材料"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {strongestSignal.count ? `${strongestSignal.count} 条` : "从阅读或实验开始"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {currentWritingPack ? (
              <Button render={<Link href={notesHref({ note: currentWritingPack.id })} />} className="bg-primary">
                <FileText className="size-4" />
                打开本周素材包
              </Button>
            ) : (
              <form action={createWritingPackNote}>
                <SubmitButton>
                  <FileText className="size-4" />
                  生成素材包
                </SubmitButton>
              </form>
            )}
            <Button render={<Link href={notesHref({ focus: "writing" })} />} variant="outline" className="bg-white/68">
              <PenLine className="size-4" />
              只看写作素材
            </Button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {signals.map((signal, index) => (
            <WritingMaterialSignalCard key={signal.label} index={index + 1} signal={signal} />
          ))}
        </div>
      </div>
    </section>
  );
}

function InboxTriageBoard({
  signals,
  triageNotes,
}: {
  signals: InboxTriageSignal[];
  triageNotes: Array<{ action: string; note: Note; score: number }>;
}) {
  const totalSignals = signals.reduce((sum, signal) => sum + signal.count, 0);

  return (
    <section className="note-triage-board overflow-hidden rounded-3xl border border-border/60 p-4 shadow-[0_18px_42px_rgba(27,42,56,0.048)]">
      <div className="grid gap-4 xl:grid-cols-[0.3fr_0.7fr] xl:items-stretch">
        <div className="note-triage-lead rounded-2xl border border-white/70 p-4">
          <span className="research-eyebrow">
            <FolderOpen className="size-3.5" />
            收件箱清理台
          </span>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight hero-title">
            临时笔记不要长期堆着，先决定它要去哪里。
          </h2>
          <p className="mt-3 text-sm leading-6 hero-copy">
            不复制 Obsidian 的完整知识图谱。这里只处理研究生日常最常见的四件事：
            归档、拆任务、补双链、沉淀写作素材。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">待整理信号</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{totalSignals}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">优先笔记</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{triageNotes.length}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {triageNotes.length ? (
              <form action={createNoteCloseoutNote}>
                {triageNotes.slice(0, 3).map(({ note }) => (
                  <input key={note.id} type="hidden" name="ids" value={note.id} />
                ))}
                <SubmitButton className="w-fit">
                  <FileText className="size-4" />
                  生成清理清单
                </SubmitButton>
              </form>
            ) : null}
            <Button render={<Link href={notesHref({ focus: "inbox" })} />} variant="outline" className="bg-white/68">
              <FolderOpen className="size-4" />
              只看收件箱
            </Button>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {signals.map((signal, index) => (
              <InboxTriageSignalCard key={signal.label} index={index + 1} signal={signal} />
            ))}
          </div>

          <div className="grid gap-2 rounded-2xl border border-white/70 bg-white/56 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold hero-title">今天优先处理</p>
              <span className="rounded-full border border-white/72 bg-white/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                最多 4 篇
              </span>
            </div>
            {triageNotes.length ? (
              <div className="grid gap-2 lg:grid-cols-2">
                {triageNotes.map(({ action, note }) => (
                  <InboxTriageNoteRow key={note.id} action={action} note={note} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function InboxTriageSignalCard({
  index,
  signal,
}: {
  index: number;
  signal: InboxTriageSignal;
}) {
  const Icon = signal.icon;
  const tone = inboxTriageToneClass(signal.tone);

  return (
    <Link href={signal.href} className={cn("note-triage-signal group", tone.card)}>
      <span className="flex items-start justify-between gap-3">
        <span className={cn("note-triage-icon", tone.icon)}>
          <Icon className="size-4" />
        </span>
        <span className="rounded-full border border-white/72 bg-white/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
          {index.toString().padStart(2, "0")}
        </span>
      </span>
      <span className="mt-4 block">
        <span className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold leading-snug hero-title">{signal.label}</span>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", tone.pill)}>
            {signal.count}
          </span>
        </span>
        <span className="sr-only">
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

function InboxTriageNoteRow({ action, note }: { action: string; note: Note }) {
  return (
    <Link
      href={notesHref({ note: note.id })}
      className="group grid gap-3 rounded-xl border border-white/72 bg-white/66 p-3 transition hover:border-primary/25 hover:bg-white sm:grid-cols-[auto_1fr_auto] sm:items-center"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#d5e4e8] bg-[#eef6f7] text-primary">
        <NotebookPen className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="line-clamp-1 text-sm font-semibold hero-title">{note.title}</span>
        <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">
          {folderLabel(note.folder)} · 更新 {formatDateTime(note.updatedAt)}
        </span>
      </span>
      <span className="rounded-full border border-white/80 bg-white/78 px-2.5 py-1 text-xs font-semibold text-primary">
        {action}
      </span>
    </Link>
  );
}

function inboxTriageToneClass(tone: InboxTriageSignal["tone"]) {
  return {
    inbox: {
      card: "from-[#fbf8ef] to-[#f4f0e3]",
      icon: "border-[#ead9ad] bg-[#fff8e7] text-[#765a23]",
      pill: "border-[#ead9ad] bg-[#fff8e7] text-[#765a23]",
    },
    link: {
      card: "from-[#f9fbff] to-[#eef5fb]",
      icon: "border-[#d3e2ee] bg-[#eef6fb] text-[#365a7d]",
      pill: "border-[#d3e2ee] bg-[#eef6fb] text-[#365a7d]",
    },
    task: {
      card: "from-[#fbfff8] to-[#eef7ed]",
      icon: "border-[#d5e8d6] bg-[#eef8ed] text-[#3f6c4d]",
      pill: "border-[#d5e8d6] bg-[#eef8ed] text-[#3f6c4d]",
    },
    writing: {
      card: "from-[#fbf9ff] to-[#f0edf8]",
      icon: "border-[#ded6ec] bg-[#f4efff] text-[#5f4f84]",
      pill: "border-[#ded6ec] bg-[#f4efff] text-[#5f4f84]",
    },
  }[tone];
}

function WritingMaterialSignalCard({
  index,
  signal,
}: {
  index: number;
  signal: WritingMaterialSignal;
}) {
  const Icon = signal.icon;
  const tone = writingMaterialToneClass(signal.tone);

  return (
    <Link href={signal.href} className={cn("writing-signal-card group", tone.card)}>
      <span className="flex items-start justify-between gap-3">
        <span className={cn("writing-signal-icon", tone.icon)}>
          <Icon className="size-4" />
        </span>
        <span className="rounded-full border border-white/72 bg-white/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
          {index.toString().padStart(2, "0")}
        </span>
      </span>
      <span className="mt-4 block">
        <span className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold leading-snug hero-title">{signal.label}</span>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", tone.pill)}>
            {signal.count}
          </span>
        </span>
        <span className="sr-only">
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

function writingMaterialToneClass(tone: WritingMaterialTone) {
  return {
    reading: {
      card: "from-[#f9fbff] to-[#eef5fb]",
      icon: "border-[#d3e2ee] bg-[#eef6fb] text-[#365a7d]",
      pill: "border-[#d3e2ee] bg-[#eef6fb] text-[#365a7d]",
    },
    experiment: {
      card: "from-[#fbfff8] to-[#eef7ed]",
      icon: "border-[#d5e8d6] bg-[#eef8ed] text-[#3f6c4d]",
      pill: "border-[#d5e8d6] bg-[#eef8ed] text-[#3f6c4d]",
    },
    result: {
      card: "from-[#fffdf6] to-[#f8f1df]",
      icon: "border-[#ead9ad] bg-[#fff8e7] text-[#765a23]",
      pill: "border-[#ead9ad] bg-[#fff8e7] text-[#765a23]",
    },
    meeting: {
      card: "from-[#fffafa] to-[#f6eeee]",
      icon: "border-[#ead5d5] bg-[#fff1ee] text-[#7a4b42]",
      pill: "border-[#ead5d5] bg-[#fff1ee] text-[#7a4b42]",
    },
    writing: {
      card: "from-[#fbf9ff] to-[#f0edf8]",
      icon: "border-[#ded6ec] bg-[#f4efff] text-[#5f4f84]",
      pill: "border-[#ded6ec] bg-[#f4efff] text-[#5f4f84]",
    },
  }[tone];
}

function NoteStackItem({
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

function QuickNoteCapture() {
  return (
    <details className="group border-b border-border/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(239,247,247,0.68))] p-3.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-[#d5e4e8] bg-white/72 px-3 py-2.5 transition hover:bg-white [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#d5e4e8] bg-[#eef6f4] text-primary">
            <PenLine className="size-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">30 秒摘一句</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              灵感、导师原话、实验现象先收住
            </span>
          </span>
        </span>
        <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] font-medium text-primary">
          展开
        </span>
      </summary>
      <form action={createNote} className="mt-3 grid gap-2.5">
        <Input
          name="title"
          required
          placeholder="一句标题，例如：导师提醒的对照组"
          className="h-9 border-[#d4e0e5] bg-white/90"
        />
        <input type="hidden" name="folder" value="Inbox" />
        <input type="hidden" name="tags" value="quick-note, 收件箱" />
        <Textarea
          name="content"
          required
          rows={4}
          placeholder={"先把原话、观察或想法收住。\n- 背景：\n- 下一步："}
          className="min-h-28 resize-none border-[#d4e0e5] bg-white/90 text-sm leading-6"
        />
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d5e4e8] bg-white/58 px-3 py-2">
          <p className="sr-only">
            默认进收件箱，之后再归档。
          </p>
          <SubmitButton className="w-fit">收进笔记</SubmitButton>
        </div>
      </form>
    </details>
  );
}

function NoteRadarItem({
  active = false,
  icon: Icon,
  label,
  value,
  detail,
  href,
  tone = "blue",
}: {
  active?: boolean;
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  href: string;
  tone?: "blue" | "warm" | "green" | "quiet";
}) {
  const toneClass = {
    blue: "border-[#d5e4e8] bg-[#eef6f7] text-primary",
    warm: "border-[#edd8a5] bg-[#fff7df] text-[#7a5a2f]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    quiet: "border-border/70 bg-white/72 text-muted-foreground",
  }[tone];

  return (
    <Link
      href={href}
      className={cn(
        "group grid gap-2 rounded-xl border border-border/70 bg-white/74 p-2.5 transition hover:border-primary/25 hover:bg-white",
        active && "border-primary/30 bg-primary/8 shadow-[0_8px_22px_rgba(27,42,56,0.055)]",
      )}
    >
      <span className="flex items-center gap-2">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${toneClass}`}>
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{label}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              {active ? (
                <span className="rounded-full border border-primary/20 bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  筛选中
                </span>
              ) : null}
              <span className="text-xs font-medium text-primary">{value}</span>
            </span>
          </span>
          <span className="sr-only">
            {detail}
          </span>
        </span>
      </span>
    </Link>
  );
}

function NoteSourceChip({
  active,
  count,
  detail,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  count: number;
  detail: string;
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-xl border border-border/70 bg-white/74 p-2.5 transition hover:border-primary/25 hover:bg-white",
        active && "border-primary/35 bg-primary/9 shadow-[0_8px_20px_rgba(37,99,235,0.07)]",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <span className="flex size-7 items-center justify-center rounded-lg border border-[#d5e4e8] bg-[#eef6f7] text-primary">
            <Icon className="size-3.5" />
          </span>
          {label}
        </span>
        <span className="rounded-full border bg-white px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {count}
        </span>
      </span>
      <span className="sr-only">
        {detail}
      </span>
    </Link>
  );
}

function NoteForm({
  action,
  note,
  defaultFolder,
}: {
  action: (formData: FormData) => Promise<void>;
  note?: Note;
  defaultFolder: string;
}) {
  return (
    <form action={action} className="flex h-full min-h-[620px] flex-col lg:min-h-0">
      {note ? <input type="hidden" name="id" value={note.id} /> : null}
      <div className="grid gap-3 border-b border-border/75 bg-[#fffefa] px-4 py-4 lg:grid-cols-[minmax(0,1fr)_170px_210px]">
        <Field label="标题">
          <Input
            name="title"
            required
            placeholder="例如：组会记录、论文摘录、实验复盘"
            defaultValue={note?.title ?? ""}
            className="h-11 border-[#d8ded5] bg-white/86 text-base font-semibold"
          />
        </Field>
        <Field label="分类">
          <Input
            name="folder"
            defaultValue={note?.folder ?? defaultFolder}
            className="h-11 border-[#d8ded5] bg-white/86"
          />
        </Field>
        <Field label="标签">
          <Input
            name="tags"
            placeholder="组会, 阅读, 想法"
            defaultValue={parseTags(note?.tags).join(", ")}
            className="h-11 border-[#d8ded5] bg-white/86"
          />
        </Field>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,#f8f6ec,#f6f4e9)] p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <PenLine className="size-3.5" />
            暖纸写作区
          </span>
          <span className="sr-only">先写下材料，保存后自动更新预览和双链</span>
        </div>
        <Textarea
          name="content"
          rows={26}
          className="field-sizing-fixed h-full min-h-[520px] flex-1 resize-none rounded-3xl border-[#d8ded5] bg-[#fffef8] p-5 text-sm leading-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_30px_rgba(42,48,38,0.035)] focus-visible:ring-2 lg:min-h-0"
          defaultValue={note?.content ?? defaultNoteContent}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-border/75 bg-[#fffefa] px-4 py-3">
        <div className="flex items-center gap-2">
          <Button render={<Link href="/notes" />} variant="outline">
            <ArrowRight className="size-4" />
            回到列表
          </Button>
          <SubmitButton className="min-w-28">{note ? "保存笔记" : "收进笔记"}</SubmitButton>
        </div>
      </div>
    </form>
  );
}

const defaultNoteContent = `## 记录

- 背景：
- 关键观察：
- 下一步：
`;
