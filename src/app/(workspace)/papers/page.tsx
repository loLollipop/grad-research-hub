import { ExternalLink, FileText, RefreshCw, Trash2 } from "lucide-react";
import type { Paper, Prisma } from "@prisma/client";

import {
  createPaper,
  deletePaper,
  syncZoteroPapers,
  updatePaper,
  updatePaperStatus,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDate, parseTags } from "@/lib/format";
import { getZoteroConfigStatus } from "@/lib/zotero";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const zotero = await getZoteroConfigStatus();

  const where: Prisma.PaperWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { authors: { contains: q, mode: "insensitive" } },
      { tags: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { doi: { contains: q, mode: "insensitive" } },
      { arxivId: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status && ["unread", "reading", "read"].includes(status)) {
    where.readStatus = status;
  }
  if (category) {
    where.category = { contains: category, mode: "insensitive" };
  }

  const papers = await prisma.paper.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  const lastSyncedAt = papers
    .map((paper) => paper.lastSyncedAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="文献"
        title="Zotero 文献台"
        description="文献库继续交给 Zotero 管理，这里同步元数据、阅读状态、标签和笔记，减少重复录入。"
        actions={
          <form action={syncZoteroPapers}>
            <SubmitButton variant="outline">
              <RefreshCw className="size-4" />
              同步 Zotero
            </SubmitButton>
          </form>
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <StatusCard label="同步状态" value={zotero.ready ? "已配置" : "待配置"} />
        <StatusCard label="当前文献" value={`${papers.length} 篇`} />
        <StatusCard
          label="最近同步"
          value={lastSyncedAt ? formatDate(lastSyncedAt) : "暂无"}
        />
      </section>

      {!zotero.ready ? (
        <Card className="rounded-lg border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900">
            Zotero 同步需要在服务器 `.env` 中配置 `ZOTERO_API_KEY` 和
            `ZOTERO_LIBRARY_ID`。配置后回到这里点击同步即可。
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3">
        <form className="grid gap-2 rounded-lg border bg-white/95 p-3 md:grid-cols-[1fr_150px_170px_auto]">
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
          <Input name="category" placeholder="Zotero 分类/集合" defaultValue={category} />
          <Button type="submit" variant="outline">
            筛选
          </Button>
        </form>

        <details className="rounded-lg border bg-white/95 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            手动补录文献
          </summary>
          <div className="mt-4 max-w-3xl">
            <PaperForm action={createPaper} />
          </div>
        </details>

        {papers.length ? (
          papers.map((paper) => <PaperCard key={paper.id} paper={paper} />)
        ) : (
          <EmptyState
            icon={FileText}
            title="暂无文献"
            description="优先同步 Zotero；少量未进入 Zotero 的材料可以手动补录。"
          />
        )}
      </section>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-lg bg-white/95">
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function PaperCard({ paper }: { paper: Paper }) {
  return (
    <Card className="rounded-lg bg-white/95">
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

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{paper.category || "未分类"}</span>
          {paper.doi ? <span>DOI {paper.doi}</span> : null}
          {paper.arxivId ? <span>arXiv {paper.arxivId}</span> : null}
          <span>更新 {formatDate(paper.updatedAt)}</span>
          {paper.externalUrl ? (
            <a
              className="inline-flex items-center gap-1 text-[#1f3d33] underline-offset-4 hover:underline"
              href={paper.externalUrl}
            >
              <ExternalLink className="size-3" />
              原文链接
            </a>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <details className="rounded-md border px-2 py-1 text-sm">
            <summary className="cursor-pointer">编辑笔记</summary>
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
      </CardContent>
    </Card>
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
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="来源">
          <Input name="journal" defaultValue={paper?.journal ?? ""} />
        </Field>
        <Field label="分类">
          <Input name="category" defaultValue={paper?.category ?? "inbox"} />
        </Field>
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
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="DOI">
          <Input name="doi" defaultValue={paper?.doi ?? ""} />
        </Field>
        <Field label="外部链接">
          <Input name="externalUrl" defaultValue={paper?.externalUrl ?? ""} />
        </Field>
      </div>
      <Field label="标签">
        <Input name="tags" defaultValue={parseTags(paper?.tags).join(", ")} />
      </Field>
      <Field label="摘要">
        <Textarea name="abstract" rows={3} defaultValue={paper?.abstract ?? ""} />
      </Field>
      <Field label="阅读笔记">
        <Textarea name="notes" rows={5} defaultValue={paper?.notes ?? ""} />
      </Field>
      <SubmitButton>{paper ? "保存文献" : "添加文献"}</SubmitButton>
    </form>
  );
}
