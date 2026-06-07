import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Clock3,
  FileText,
  FolderOpen,
  Link2,
  ListTodo,
  NotebookPen,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Note, Prisma } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { createNote, createTasksFromNoteChecklist, deleteNote, updateNote } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { extractWikiLinks, formatDateTime, parseTags } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Field } from "@/components/shared/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    folder?: string;
    mode?: string;
    note?: string;
    q?: string;
    taskSync?: string;
  }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

function noteActionScore(note: Note, allNotes: Note[]) {
  const ageHours = Math.max(1, (Date.now() - note.updatedAt.getTime()) / 36e5);
  const recency = 1 / ageHours;
  const checklist = openChecklistCount(note.content);
  const links = uniqueWikiLinks(note.content);
  const allTitles = new Set(allNotes.map((item) => normalizeTitle(item.title)));
  const missingLinkCount = links.filter((link) => !allTitles.has(normalizeTitle(link))).length;

  return recency + checklist * 5 + missingLinkCount * 2 + links.length + (isWritingMaterial(note) ? 1.5 : 0);
}

export default async function NotesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q)?.trim();
  const folder = first(params.folder)?.trim();
  const mode = first(params.mode);
  const noteId = first(params.note);
  const taskSync = first(params.taskSync);

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
  const [notes, allNotes, folders] = await Promise.all([
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
  ]);
  const totalNotes = allNotes.length;
  const selectedNote = noteId ? allNotes.find((note) => note.id === noteId) : notes[0];
  const activeNote = mode === "new" ? undefined : selectedNote;
  const activeLinks = activeNote ? uniqueWikiLinks(activeNote.content) : [];
  const defaultFolder = folder || "Inbox";
  const noteTitleMap = new Map<string, Note>();
  allNotes.forEach((note) => {
    const title = normalizeTitle(note.title);
    if (!noteTitleMap.has(title)) {
      noteTitleMap.set(title, note);
    }
  });
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

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="research-eyebrow">
                <NotebookPen className="size-3.5" />
                笔记工作室
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                阅读 · 实验 · 组会 · 写作
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              笔记页只做一件事：把碎片变成可继续推进的材料。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              这里承接 Zotero 阅读、实验复盘、结果证据和组会草稿。左侧快速找材料，
              右侧专心写作，用 `[[双链]]` 和待办清单把想法接回项目任务。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button render={<Link href="/notes?mode=new" />} className="bg-primary">
                <Plus className="size-4" />
                新建笔记
              </Button>
              <Button render={<Link href="/notes" />} variant="outline">
                <Clock3 className="size-4" />
                最近更新
              </Button>
            </div>
          </div>

          <div className="flex min-h-64 flex-col justify-between rounded-2xl action-stack p-4 text-white shadow-[0_18px_36px_rgba(22,34,53,0.16)]">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-white/68">
                <BookOpenText className="size-3.5" />
                今日沉淀栈
              </p>
              <div className="mt-4 grid gap-2.5">
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
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
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

      <section className="grid flex-1 gap-4 lg:h-[calc(100vh-222px)] lg:min-h-[720px] lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="workbench-card flex min-h-[560px] flex-col overflow-hidden rounded-2xl border bg-white/95 py-0 lg:min-h-0">
          <div className="border-b border-border/75 bg-white/62 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Search className="size-4 text-primary" />
                检索笔记
              </div>
              <span className="rounded-full border bg-white px-2 py-0.5 text-xs text-muted-foreground">
                {notes.length} / {totalNotes}
              </span>
            </div>
            <form className="mt-3 grid gap-2">
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
                href="/notes"
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
                    href={`/notes?folder=${encodeURIComponent(item.folder)}`}
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
                最近笔记
              </div>
              {q || folder ? (
                <Button render={<Link href="/notes" />} variant="ghost" size="sm">
                  清除
                </Button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3.5">
              {notes.length ? (
                <div className="grid gap-2">
                  {notes.map((note) => {
                    const selected = activeNote?.id === note.id;
                    const snippet = noteSnippet(note.content);
                    const action = noteActionLabel(note, allNotes);

                    return (
                      <Link
                        key={note.id}
                        href={`/notes?note=${note.id}`}
                        className={cn(
                          "rounded-xl border border-border/75 bg-white/72 px-3 py-2.5 text-sm transition hover:border-primary/25 hover:bg-white",
                          selected && "border-primary/35 bg-primary/9 shadow-[0_8px_20px_rgba(37,99,235,0.08)]",
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
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-5 text-center">
                  <NotebookPen className="mb-2 size-7 text-muted-foreground" />
                  <p className="text-sm font-medium">暂无匹配笔记</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    换个关键词，或者直接新建一篇。
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <section
          id={activeNote ? `note-${activeNote.id}` : "new-note"}
          className="workbench-card flex min-h-[690px] flex-col overflow-hidden rounded-2xl border bg-white/95 py-0 lg:min-h-0"
        >
          <div className="grid gap-3 border-b border-border/75 bg-white/66 px-4 py-3.5 md:grid-cols-[1fr_auto] md:items-start">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FileText className="size-3.5 text-primary" />
                {activeNote
                  ? `${folderLabel(activeNote.folder)} · 更新 ${formatDateTime(activeNote.updatedAt)}`
                  : "新笔记 · 默认保存到收件箱"}
              </div>
              <h2 className="truncate text-lg font-semibold tracking-tight">
                {activeNote ? activeNote.title : "写一篇新笔记"}
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
            <div className="flex flex-col gap-2 border-b border-border/75 bg-white px-4 py-2.5 md:flex-row md:items-center md:justify-between">
              <TabsList className="h-8 bg-muted/70">
                <TabsTrigger value="edit">编辑</TabsTrigger>
                <TabsTrigger value="preview">预览</TabsTrigger>
                <TabsTrigger value="links">双链</TabsTrigger>
              </TabsList>
              <p className="text-xs text-muted-foreground">
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
              className="min-h-0 flex-1 overflow-y-auto bg-[#fbfcfd] p-4 md:p-6"
            >
              <article className="mx-auto min-h-full max-w-4xl rounded-2xl border border-border/72 bg-white px-5 py-5 text-sm leading-7 shadow-[0_10px_28px_rgba(27,42,56,0.045)] md:px-7">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeNote?.content || "保存一篇笔记后，这里会显示 Markdown 预览。"}
                </ReactMarkdown>
              </article>
            </TabsContent>

            <TabsContent value="links" className="min-h-0 flex-1 overflow-y-auto bg-[#fbfcfd] p-4 md:p-5">
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
                      ) : (
                        <p className="text-sm leading-7 text-muted-foreground">
                          当前笔记还没有 `[[双链]]`。写阅读札记或实验想法时，可以直接引用相关主题。
                        </p>
                      )}
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
                    ) : (
                      <p className="text-sm leading-7 text-muted-foreground">
                        当前引用都能找到对应笔记。继续写就好，不需要额外维护关系表。
                      </p>
                    )}
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
                    ) : (
                      <p className="text-sm leading-7 text-muted-foreground">
                        还没有匹配到同名笔记。可以先保留引用，后续补一篇同名主题笔记。
                      </p>
                    )}
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
                    ) : (
                      <p className="text-sm leading-7 text-muted-foreground">
                        暂时没有其他笔记引用当前标题。等阅读摘录、实验复盘写多后，这里会自动长出来。
                      </p>
                    )}
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
    <form action={action} className="flex h-full min-h-[580px] flex-col lg:min-h-0">
      {note ? <input type="hidden" name="id" value={note.id} /> : null}
      <div className="grid gap-3 border-b border-border/75 bg-white px-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px_220px]">
        <Field label="标题">
          <Input
            name="title"
            required
            placeholder="例如：组会记录、论文摘录、实验复盘"
            defaultValue={note?.title ?? ""}
            className="h-10 text-base font-medium"
          />
        </Field>
        <Field label="分类">
          <Input name="folder" defaultValue={note?.folder ?? defaultFolder} className="h-10" />
        </Field>
        <Field label="标签">
          <Input
            name="tags"
            placeholder="组会, 阅读, 想法"
            defaultValue={parseTags(note?.tags).join(", ")}
            className="h-10"
          />
        </Field>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[#f6f8fb] p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <PenLine className="size-3.5" />
            正文
          </span>
          <span>写完后保存即可更新预览和双链</span>
        </div>
        <Textarea
          name="content"
          rows={26}
          className="field-sizing-fixed min-h-[460px] flex-1 resize-none rounded-2xl border-border/80 bg-white p-5 text-sm leading-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_28px_rgba(27,42,56,0.035)] focus-visible:ring-2 lg:min-h-0"
          defaultValue={note?.content ?? defaultNoteContent}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border/75 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-muted-foreground">
          临时想法可以先放收件箱，后面再整理分类和双链。
        </p>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/notes" />} variant="outline">
            <ArrowRight className="size-4" />
            回到列表
          </Button>
          <SubmitButton className="min-w-28">{note ? "保存笔记" : "创建笔记"}</SubmitButton>
        </div>
      </div>
    </form>
  );
}

const defaultNoteContent = `## 记录

- 背景：
- 关键观察：
- 下一步：

可以使用 [[双链标题]] 连接相关文献、实验或想法。
`;
