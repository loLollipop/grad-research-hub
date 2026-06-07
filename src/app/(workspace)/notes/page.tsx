import Link from "next/link";
import { NotebookTabs, Plus, Trash2 } from "lucide-react";
import type { Note } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { createNote, deleteNote, updateNote } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { extractWikiLinks, formatDateTime, parseTags } from "@/lib/format";
import { Field } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const selectedNote = noteId ? notes.find((note) => note.id === noteId) : notes[0];
  const activeNote = mode === "new" ? undefined : selectedNote;
  const activeLinks = activeNote ? extractWikiLinks(activeNote.content) : [];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="笔记"
        title="笔记知识库"
        description="记录想法、会议、阅读摘录和临时材料；部署配置和接口密钥统一放在设置中心。"
        actions={
          <Button render={<Link href="/notes?mode=new" />} variant="outline" className="bg-white/90">
            <Plus className="size-4" />
            新建笔记
          </Button>
        }
      />

      <section className="grid min-h-[calc(100vh-220px)] gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="grid min-h-0 gap-4 lg:grid-rows-[auto_1fr]">
          <Card className="rounded-lg bg-white/95">
            <CardHeader>
              <CardTitle>分类</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {folders.length ? (
                folders.map((item) => (
                  <div
                    key={item.folder}
                    className="flex justify-between rounded-md border px-3 py-2"
                  >
                    <span>{item.folder}</span>
                    <span className="text-muted-foreground">{item._count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">还没有分类。</p>
              )}
            </CardContent>
          </Card>

          <Card className="min-h-0 rounded-lg bg-white/95">
            <CardHeader>
              <CardTitle>最近笔记</CardTitle>
            </CardHeader>
            <CardContent className="grid max-h-[42vh] gap-2 overflow-y-auto text-sm">
              {notes.length ? (
                notes.map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes?note=${note.id}`}
                    className="rounded-md border px-3 py-2 transition hover:border-primary/25 hover:bg-muted/50"
                  >
                    <span className="line-clamp-1 font-medium">{note.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {note.folder} · {formatDateTime(note.updatedAt)}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4 text-center">
                  <NotebookTabs className="mb-2 size-6 text-muted-foreground" />
                  <p className="text-sm font-medium">暂无笔记</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    右侧可以直接开始写第一篇。
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <div className="grid min-h-0 gap-3">
          <form className="grid gap-2 rounded-lg border bg-white/95 p-3 md:grid-cols-[1fr_180px_auto]">
            <Input name="q" placeholder="搜索标题、正文、标签" defaultValue={q} />
            <Input name="folder" placeholder="分类" defaultValue={folder} />
            <Button type="submit" variant="outline">
              筛选
            </Button>
          </form>

          <Card
            id={activeNote ? `note-${activeNote.id}` : "new-note"}
            className="min-h-[calc(100vh-315px)] rounded-lg bg-white/95"
          >
            <CardContent className="grid h-full gap-3 py-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="font-semibold">
                    {activeNote ? activeNote.title : "写一篇新笔记"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeNote
                      ? `${activeNote.folder} · 更新 ${formatDateTime(activeNote.updatedAt)}`
                      : "默认保存到收件箱，之后可以再整理分类和标签。"}
                  </p>
                </div>
                {activeNote ? <TagList value={activeNote.tags} /> : null}
              </div>
              <Tabs defaultValue={activeNote ? "edit" : "edit"} className="grid h-full gap-3">
                <TabsList>
                  <TabsTrigger value="edit">编辑</TabsTrigger>
                  <TabsTrigger value="preview">预览</TabsTrigger>
                  <TabsTrigger value="links">双链</TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="rounded-lg border p-4">
                  <NoteForm
                    action={activeNote ? updateNote : createNote}
                    note={activeNote}
                    tall
                  />
                  {activeNote ? (
                    <form action={deleteNote} className="mt-3">
                      <input type="hidden" name="id" value={activeNote.id} />
                      <Button type="submit" variant="destructive">
                        <Trash2 className="size-4" />
                        删除笔记
                      </Button>
                    </form>
                  ) : null}
                </TabsContent>
                <TabsContent
                  value="preview"
                  className="min-h-[calc(100vh-430px)] rounded-lg border bg-[#fffdf7] p-4 text-sm leading-6"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeNote?.content || "保存一篇笔记后，这里会显示 Markdown 预览。"}
                  </ReactMarkdown>
                </TabsContent>
                <TabsContent value="links" className="min-h-56 rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">
                    {activeLinks.length
                      ? activeLinks.map((link) => `[[${link}]]`).join(" · ")
                      : "当前笔记还没有 [[双链]] 引用。"}
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function NoteForm({
  action,
  note,
  tall = false,
}: {
  action: (formData: FormData) => Promise<void>;
  note?: Note;
  tall?: boolean;
}) {
  return (
    <form action={action} className="grid gap-3">
      {note ? <input type="hidden" name="id" value={note.id} /> : null}
      <Field label="标题">
        <Input name="title" required defaultValue={note?.title ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="分类">
          <Input name="folder" defaultValue={note?.folder ?? "收件箱"} />
        </Field>
        <Field label="标签">
          <Input name="tags" defaultValue={parseTags(note?.tags).join(", ")} />
        </Field>
      </div>
      <Field label="内容">
        <Textarea
          name="content"
          rows={tall ? 18 : 12}
          className={tall ? "min-h-[calc(100vh-560px)]" : undefined}
          defaultValue={note?.content ?? "## 记录\n\n可以使用 [[双链标题]]。"}
        />
      </Field>
      <SubmitButton>{note ? "保存笔记" : "创建笔记"}</SubmitButton>
    </form>
  );
}
