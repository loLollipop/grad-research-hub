import { FileText, Trash2 } from "lucide-react";
import type { Paper, Prisma } from "@prisma/client";

import {
  createPaper,
  deletePaper,
  updatePaper,
  updatePaperStatus,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDate, parseTags } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
};

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PapersPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = valueOf(params.q)?.trim();
  const status = valueOf(params.status);
  const category = valueOf(params.category)?.trim();

  const where: Prisma.PaperWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { authors: { contains: q } },
      { tags: { contains: q } },
      { notes: { contains: q } },
      { doi: { contains: q } },
      { arxivId: { contains: q } },
      { zoteroKey: { contains: q } },
      { bibtexKey: { contains: q } },
      { externalUrl: { contains: q } },
    ];
  }
  if (status && ["unread", "reading", "read"].includes(status)) {
    where.readStatus = status;
  }
  if (category) {
    where.category = { contains: category };
  }

  const papers = await prisma.paper.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Literature"
        title="文献管理"
        description="先把论文条目、阅读状态和笔记放到一个可搜索的地方；DOI、arXiv、Zotero 后续可继续增强。"
      />

      <section className="grid gap-4 lg:grid-cols-[0.86fr_1.14fr]">
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>新增文献</CardTitle>
          </CardHeader>
          <CardContent>
            <PaperForm action={createPaper} />
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <form className="grid gap-2 rounded-lg border bg-white/95 p-3 md:grid-cols-[1fr_150px_150px_auto]">
            <Input name="q" placeholder="搜索标题、作者、标签、笔记" defaultValue={q} />
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部状态</option>
              <option value="unread">未读</option>
              <option value="reading">读中</option>
              <option value="read">已读</option>
            </select>
            <Input name="category" placeholder="分类" defaultValue={category} />
            <Button type="submit" variant="outline">
              筛选
            </Button>
          </form>

          {papers.length ? (
            papers.map((paper) => (
              <Card key={paper.id} className="rounded-lg bg-white/95">
                <CardContent className="grid gap-3 py-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{paper.title}</h2>
                        <StatusBadge value={paper.readStatus} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {parseTags(paper.authors).join(", ") || "作者未知"} ·{" "}
                        {paper.year ?? "年份未知"} · {paper.journal ?? "来源未填"}
                      </p>
                    </div>
                    <form action={updatePaperStatus} className="flex gap-2">
                      <input type="hidden" name="id" value={paper.id} />
                      <select
                        name="readStatus"
                        defaultValue={paper.readStatus}
                        className="h-8 rounded-lg border bg-background px-2 text-sm"
                      >
                        <option value="unread">未读</option>
                        <option value="reading">读中</option>
                        <option value="read">已读</option>
                      </select>
                      <Button type="submit" variant="outline">
                        更新
                      </Button>
                    </form>
                  </div>
                  <TagList value={paper.tags} />
                  <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {paper.abstract ?? paper.notes ?? "暂无摘要或阅读笔记。"}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>
                      {paper.category} · DOI {paper.doi ?? "未填"} · arXiv{" "}
                      {paper.arxivId ?? "未填"} · Zotero {paper.zoteroKey ?? "未同步"} · BibTeX{" "}
                      {paper.bibtexKey ?? "未设置"} · 更新 {formatDate(paper.updatedAt)}
                    </span>
                    {paper.externalUrl ? (
                      <a className="text-[#1f3d33] underline-offset-4 hover:underline" href={paper.externalUrl}>
                        外部链接
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <details className="rounded-md border px-2 py-1">
                        <summary className="cursor-pointer">编辑</summary>
                        <div className="mt-3 w-full min-w-[min(720px,80vw)]">
                          <PaperForm action={updatePaper} paper={paper} />
                        </div>
                      </details>
                      <form action={deletePaper}>
                        <input type="hidden" name="id" value={paper.id} />
                        <Button type="submit" variant="destructive">
                          <Trash2 className="size-4" />
                          删除
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyState
              icon={FileText}
              title="暂无文献"
              description="添加第一篇论文后，可以按阅读状态、分类和标签追踪。"
            />
          )}
        </div>
      </section>
    </div>
  );
}

function PaperForm({
  action,
  paper,
}: {
  action: (formData: FormData) => Promise<void>;
  paper?: Paper;
}) {
  return (
    <form action={action} className="grid gap-3">
      {paper ? <input type="hidden" name="id" value={paper.id} /> : null}
      <Field label="标题">
        <Input name="title" required defaultValue={paper?.title ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="作者">
          <Input
            name="authors"
            placeholder="逗号分隔"
            defaultValue={parseTags(paper?.authors).join(", ")}
          />
        </Field>
        <Field label="年份">
          <Input name="year" type="number" defaultValue={paper?.year ?? ""} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="期刊/来源">
          <Input name="journal" defaultValue={paper?.journal ?? ""} />
        </Field>
        <Field label="分类">
          <Input name="category" defaultValue={paper?.category ?? "inbox"} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="阅读状态">
          <select
            name="readStatus"
            defaultValue={paper?.readStatus ?? "unread"}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="unread">未读</option>
            <option value="reading">读中</option>
            <option value="read">已读</option>
          </select>
        </Field>
        <Field label="DOI">
          <Input name="doi" defaultValue={paper?.doi ?? ""} />
        </Field>
        <Field label="arXiv ID">
          <Input name="arxivId" defaultValue={paper?.arxivId ?? ""} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Zotero Key">
          <Input name="zoteroKey" defaultValue={paper?.zoteroKey ?? ""} />
        </Field>
        <Field label="BibTeX Key">
          <Input name="bibtexKey" defaultValue={paper?.bibtexKey ?? ""} />
        </Field>
        <Field label="外部链接">
          <Input name="externalUrl" defaultValue={paper?.externalUrl ?? ""} />
        </Field>
      </div>
      <Field label="PDF 路径/链接">
        <Input name="pdfUrl" defaultValue={paper?.pdfUrl ?? ""} />
      </Field>
      <Field label="标签">
        <Input name="tags" defaultValue={parseTags(paper?.tags).join(", ")} />
      </Field>
      <Field label="摘要">
        <Textarea name="abstract" rows={3} defaultValue={paper?.abstract ?? ""} />
      </Field>
      <Field label="阅读笔记">
        <Textarea name="notes" rows={5} defaultValue={paper?.notes ?? ""} />
      </Field>
      <SubmitButton>{paper ? "保存修改" : "添加文献"}</SubmitButton>
    </form>
  );
}
