import Link from "next/link";
import {
  Clock3,
  FileText,
  FolderOpen,
  Link2,
  NotebookPen,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { Note } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { createNote, deleteNote, updateNote } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { extractWikiLinks, formatDateTime, parseTags } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Field } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; folder?: string; mode?: string; note?: string }>;
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
    .slice(0, 72);
}

export default async function NotesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q)?.trim();
  const folder = first(params.folder)?.trim();
  const mode = first(params.mode);
  const noteId = first(params.note);

  const notes = await prisma.note.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { content: { contains: q } },
              { tags: { contains: q } },
            ],
          }
        : {}),
      ...(folder ? { folder: { contains: folder } } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const folders = await prisma.note.groupBy({
    by: ["folder"],
    _count: true,
    orderBy: { folder: "asc" },
  });
  const totalNotes = folders.reduce((sum, item) => sum + item._count, 0);
  const selectedNote = noteId ? notes.find((note) => note.id === noteId) : notes[0];
  const activeNote = mode === "new" ? undefined : selectedNote;
  const activeLinks = activeNote ? extractWikiLinks(activeNote.content) : [];
  const defaultFolder = folder || "收件箱";

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-5">
      <PageHeader
        eyebrow="笔记"
        title="笔记工作台"
        description="像写研究日志一样记录组会、阅读摘录、实验想法和临时材料；左侧整理，右侧专心写。"
        actions={
          <Button render={<Link href="/notes?mode=new" />} variant="outline" className="bg-white/90">
            <Plus className="size-4" />
            新建笔记
          </Button>
        }
      />

      <section className="grid flex-1 gap-4 lg:h-[calc(100vh-220px)] lg:min-h-[680px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="workbench-card flex min-h-[540px] flex-col overflow-hidden rounded-lg border bg-white/95 py-0 lg:min-h-0">
          <div className="border-b border-border/80 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Search className="size-4 text-primary" />
                检索笔记
              </div>
              <span className="text-xs text-muted-foreground">{notes.length} / {totalNotes}</span>
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
              <Input name="folder" placeholder="分类" defaultValue={folder} className="h-9" />
              <Button type="submit" variant="outline" className="h-9 bg-white">
                筛选
              </Button>
            </form>
          </div>

          <div className="border-b border-border/80 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FolderOpen className="size-4 text-primary" />
              分类
            </div>
            <div className="grid max-h-40 gap-1 overflow-y-auto pr-1 text-sm">
              <Link
                href="/notes"
                className={cn(
                  "flex items-center justify-between rounded-md px-2.5 py-2 transition hover:bg-muted/60",
                  !folder && "bg-primary/8 text-primary ring-1 ring-primary/15",
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
                      "flex items-center justify-between rounded-md px-2.5 py-2 transition hover:bg-muted/60",
                      selected && "bg-primary/8 text-primary ring-1 ring-primary/15",
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
            <div className="flex items-center justify-between px-3 py-3">
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
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {notes.length ? (
                <div className="grid gap-2">
                  {notes.map((note) => {
                    const selected = activeNote?.id === note.id;
                    const snippet = noteSnippet(note.content);

                    return (
                      <Link
                        key={note.id}
                        href={`/notes?note=${note.id}`}
                        className={cn(
                          "rounded-md border border-border/80 bg-white/70 px-3 py-2.5 text-sm transition hover:border-primary/25 hover:bg-muted/40",
                          selected && "border-primary/35 bg-primary/7 shadow-sm",
                        )}
                      >
                        <span className="line-clamp-1 font-medium">{note.title}</span>
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
                <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-5 text-center">
                  <NotebookPen className="mb-2 size-7 text-muted-foreground" />
                  <p className="text-sm font-medium">暂无匹配笔记</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    换个关键词，或者直接在右侧开始写。
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <section
          id={activeNote ? `note-${activeNote.id}` : "new-note"}
          className="workbench-card flex min-h-[620px] flex-col overflow-hidden rounded-lg border bg-white/95 py-0 lg:min-h-0"
        >
          <div className="flex flex-col gap-3 border-b border-border/80 px-4 py-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FileText className="size-3.5 text-primary" />
                {activeNote ? `${folderLabel(activeNote.folder)} · 更新 ${formatDateTime(activeNote.updatedAt)}` : "新笔记 · 默认保存到收件箱"}
              </div>
              <h2 className="truncate text-lg font-semibold tracking-tight">
                {activeNote ? activeNote.title : "写一篇新笔记"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeNote ? <TagList value={activeNote.tags} /> : null}
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
            <div className="flex flex-col gap-2 border-b border-border/80 bg-muted/20 px-4 py-2 md:flex-row md:items-center md:justify-between">
              <TabsList className="h-8">
                <TabsTrigger value="edit">编辑</TabsTrigger>
                <TabsTrigger value="preview">预览</TabsTrigger>
                <TabsTrigger value="links">双链</TabsTrigger>
              </TabsList>
              <p className="text-xs text-muted-foreground">Markdown · 双链 · 研究日志</p>
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
              className="min-h-0 flex-1 overflow-y-auto bg-[#fffdf7] p-5 text-sm leading-7"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {activeNote?.content || "保存一篇笔记后，这里会显示 Markdown 预览。"}
              </ReactMarkdown>
            </TabsContent>

            <TabsContent value="links" className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="flex min-h-full flex-col rounded-md border border-dashed bg-muted/25 p-5">
                <div className="mb-3 flex items-center gap-2 font-medium">
                  <Link2 className="size-4 text-primary" />
                  当前笔记引用
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  {activeLinks.length
                    ? activeLinks.map((link) => `[[${link}]]`).join(" · ")
                    : "当前笔记还没有 [[双链]] 引用。"}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </section>
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
    <form action={action} className="flex h-full min-h-[520px] flex-col lg:min-h-0">
      {note ? <input type="hidden" name="id" value={note.id} /> : null}
      <div className="grid gap-3 border-b border-border/80 bg-white px-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px_220px]">
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

      <div className="flex min-h-0 flex-1 flex-col gap-2 bg-[#fbfaf5] p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium">正文</span>
          <span>研究日志</span>
        </div>
        <Textarea
          name="content"
          rows={24}
          className="field-sizing-fixed min-h-[420px] flex-1 resize-none rounded-md border-border/80 bg-white/85 p-4 text-sm leading-7 shadow-inner focus-visible:ring-2 lg:min-h-0"
          defaultValue={note?.content ?? "## 记录\n\n可以使用 [[双链标题]]。"}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border/80 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-muted-foreground">
          临时想法可以先放进收件箱。
        </p>
        <SubmitButton className="min-w-28">{note ? "保存笔记" : "创建笔记"}</SubmitButton>
      </div>
    </form>
  );
}
