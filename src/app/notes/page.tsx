import { NotebookTabs, Trash2 } from "lucide-react";
import type { Note } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { createNote, deleteNote, updateNote } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { extractWikiLinks, formatDateTime, parseTags } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
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
  searchParams: Promise<{ q?: string; folder?: string }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NotesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q)?.trim();
  const folder = first(params.folder)?.trim();

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

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Knowledge Base"
        title="笔记知识库"
        description="自由笔记、会议记录、灵感和双链文本先集中起来，后续可升级为图谱和更强编辑器。"
      />

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-4">
          <Card className="rounded-lg bg-white/95">
            <CardHeader>
              <CardTitle>新建笔记</CardTitle>
            </CardHeader>
            <CardContent>
              <NoteForm action={createNote} />
            </CardContent>
          </Card>

          <Card className="rounded-lg bg-white/95">
            <CardHeader>
              <CardTitle>文件夹</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {folders.map((item) => (
                <div key={item.folder} className="flex justify-between rounded-md border px-3 py-2">
                  <span>{item.folder}</span>
                  <span className="text-muted-foreground">{item._count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3">
          <form className="grid gap-2 rounded-lg border bg-white/95 p-3 md:grid-cols-[1fr_180px_auto]">
            <Input name="q" placeholder="搜索标题、正文、标签" defaultValue={q} />
            <Input name="folder" placeholder="文件夹" defaultValue={folder} />
            <Button type="submit" variant="outline">
              筛选
            </Button>
          </form>

          {notes.length ? (
            notes.map((note) => {
              const links = extractWikiLinks(note.content);
              return (
                <Card key={note.id} className="rounded-lg bg-white/95">
                  <CardContent className="grid gap-3 py-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="font-semibold">{note.title}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {note.folder} · 更新 {formatDateTime(note.updatedAt)}
                        </p>
                      </div>
                      <TagList value={note.tags} />
                    </div>
                    <Tabs defaultValue="preview">
                      <TabsList>
                        <TabsTrigger value="preview">预览</TabsTrigger>
                        <TabsTrigger value="links">双链</TabsTrigger>
                        <TabsTrigger value="edit">编辑</TabsTrigger>
                      </TabsList>
                      <TabsContent
                        value="preview"
                        className="rounded-lg border bg-[#fffdf7] p-4 text-sm leading-6"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {note.content || "暂无内容。"}
                        </ReactMarkdown>
                      </TabsContent>
                      <TabsContent value="links" className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">
                          {links.length
                            ? links.map((link) => `[[${link}]]`).join(" · ")
                            : "当前笔记还没有 [[双链]] 引用。"}
                        </p>
                      </TabsContent>
                      <TabsContent value="edit" className="rounded-lg border p-4">
                        <NoteForm action={updateNote} note={note} />
                        <form action={deleteNote} className="mt-3">
                          <input type="hidden" name="id" value={note.id} />
                          <Button type="submit" variant="destructive">
                            <Trash2 className="size-4" />
                            删除笔记
                          </Button>
                        </form>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon={NotebookTabs}
              title="暂无笔记"
              description="从快速捕捉或新建笔记开始，把会议和灵感先存下来。"
            />
          )}
        </div>
      </section>
    </div>
  );
}

function NoteForm({
  action,
  note,
}: {
  action: (formData: FormData) => Promise<void>;
  note?: Note;
}) {
  return (
    <form action={action} className="grid gap-3">
      {note ? <input type="hidden" name="id" value={note.id} /> : null}
      <Field label="标题">
        <Input name="title" required defaultValue={note?.title ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="文件夹">
          <Input name="folder" defaultValue={note?.folder ?? "Inbox"} />
        </Field>
        <Field label="标签">
          <Input name="tags" defaultValue={parseTags(note?.tags).join(", ")} />
        </Field>
      </div>
      <Field label="内容">
        <Textarea
          name="content"
          rows={12}
          defaultValue={note?.content ?? "## 记录\n\n可以使用 [[双链标题]]。"}
        />
      </Field>
      <SubmitButton>{note ? "保存笔记" : "创建笔记"}</SubmitButton>
    </form>
  );
}
