import Link from "next/link";
import {
  BookOpenCheck,
  Edit3,
  ExternalLink,
  FileText,
  LibraryBig,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
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
import { CreateDialog } from "@/components/shared/create-dialog";
import { Field } from "@/components/shared/field";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button, buttonVariants } from "@/components/ui/button";
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

  const [papers, allCounts, categories] = await Promise.all([
    prisma.paper.findMany({
      where,
      orderBy: [{ readStatus: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.paper.groupBy({ by: ["readStatus"], _count: true }),
    prisma.paper.groupBy({ by: ["category"], _count: true, orderBy: { _count: { category: "desc" } }, take: 8 }),
  ]);

  const lastSyncedAt = papers
    .map((paper) => paper.lastSyncedAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const unreadCount = countStatus(allCounts, "unread");
  const readingCount = countStatus(allCounts, "reading");
  const readCount = countStatus(allCounts, "read");

  return (
    <div className="grid gap-5">
      <section className="dashboard-hero overflow-hidden rounded-2xl border border-border/70 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.08)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_0.92fr] xl:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/65 bg-white/72 px-2.5 py-1 text-xs font-medium text-[#315266]">
                <LibraryBig className="size-3.5" />
                Zotero 阅读台
              </span>
              <span className="rounded-full border border-white/55 bg-white/54 px-2.5 py-1 text-xs text-muted-foreground">
                同步为主 · 手动兜底
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-[2rem] font-semibold leading-tight tracking-tight text-[#173042] md:text-[2.5rem]">
              文献不用重复录，重点放在读到哪一步。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#557083]">
              Zotero 继续作为文献库，研途 Hub 只接管阅读状态、筛选队列、标签和读后笔记。
              需要临时材料时再补录，避免把管理文献变成新的负担。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <form action={syncZoteroPapers}>
                <SubmitButton variant="default">
                  <RefreshCw className="size-4" />
                  同步 Zotero
                </SubmitButton>
              </form>
              <CreateDialog
                title="手动补录文献"
                description="只给临时材料或还没放进 Zotero 的条目使用。"
                label="补录文献"
                icon={Plus}
                wide
              >
                <PaperForm action={createPaper} />
              </CreateDialog>
              <Link className={buttonVariants({ variant: "outline" })} href="/settings">
                <Settings className="size-4" />
                Zotero 设置
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="待读" value={`${unreadCount} 篇`} detail="新同步条目" />
            <MetricCard label="读中" value={`${readingCount} 篇`} detail="当前阅读队列" />
            <MetricCard label="已读" value={`${readCount} 篇`} detail="可回顾资料" />
          </div>
        </div>
      </section>

      {!zotero.ready ? (
        <Card className="border-amber-200 bg-[#fff8eb] shadow-sm">
          <CardContent className="flex flex-col gap-3 py-4 text-sm text-amber-950 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">Zotero 尚未连接</p>
              <p className="mt-1 text-amber-900/80">
                到设置中心填写 API Key、Library ID 和同步数量后，回到这里点一次同步即可。
              </p>
            </div>
            <Link className={buttonVariants({ variant: "outline" })} href="/settings">
              <Settings className="size-4" />
              去设置
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.28fr_0.72fr]">
        <aside className="grid content-start gap-4">
          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <BookOpenCheck className="size-4 text-primary" />
                阅读节奏
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <ProgressLine label="待读" value={unreadCount} total={unreadCount + readingCount + readCount} />
              <ProgressLine label="读中" value={readingCount} total={unreadCount + readingCount + readCount} />
              <ProgressLine label="已读" value={readCount} total={unreadCount + readingCount + readCount} />
              <div className="rounded-xl border border-border/70 bg-white/70 p-3 text-xs text-muted-foreground">
                最近同步：{lastSyncedAt ? formatDate(lastSyncedAt) : "暂无"}
              </div>
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle>常用集合</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {categories.length ? (
                categories.map((item) => (
                  <Link
                    key={item.category}
                    href={`/papers?category=${encodeURIComponent(item.category)}`}
                    className="flex items-center justify-between rounded-xl border border-border/72 bg-[#fbfcfd]/88 px-3 py-2 text-sm transition hover:border-primary/25 hover:bg-white"
                  >
                    <span className="line-clamp-1">{item.category || "未分类"}</span>
                    <span className="text-xs text-muted-foreground">{item._count}</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">同步后会显示 Zotero 集合。</p>
              )}
            </CardContent>
          </Card>
        </aside>

        <div className="grid gap-3">
          <form className="grid gap-2 rounded-2xl border border-border/72 bg-white/88 p-3 shadow-[0_12px_28px_rgba(27,42,56,0.045)] md:grid-cols-[1fr_150px_170px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" placeholder="搜索标题、作者、标签、笔记" defaultValue={q} className="pl-8" />
            </div>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-9 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部状态</option>
              <option value="unread">待读</option>
              <option value="reading">读中</option>
              <option value="read">已读</option>
            </select>
            <Input name="category" placeholder="集合 / 分类" defaultValue={category} />
            <Button type="submit" variant="outline">
              筛选
            </Button>
          </form>

          {papers.length ? (
            <div className="grid gap-3">
              {papers.map((paper) => <PaperCard key={paper.id} paper={paper} />)}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="暂无文献"
              description="优先同步 Zotero；少量未进入 Zotero 的材料可以手动补录。"
            />
          )}
        </div>
      </section>
    </div>
  );
}

function countStatus(
  counts: Array<{ readStatus: string; _count: number }>,
  status: string,
) {
  return counts.find((item) => item.readStatus === status)?._count ?? 0;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="border-white/72 bg-white/76 shadow-[0_12px_28px_rgba(27,42,56,0.06)] backdrop-blur">
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-[#173042]">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ProgressLine({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total ? Math.round((value / total) * 100) : 0;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/72" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function PaperCard({ paper }: { paper: Paper }) {
  const authors = parseTags(paper.authors);

  return (
    <Card className="workbench-card">
      <CardContent className="grid gap-3 py-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={paper.readStatus} />
              <span className="rounded-md border bg-white/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {paper.category || "未分类"}
              </span>
            </div>
            <h2 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">
              {paper.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {authors.join(", ") || "作者未知"} · {paper.year ?? "年份未知"} ·{" "}
              {paper.journal ?? "来源未填"}
            </p>
          </div>
          <form action={updatePaperStatus} className="flex gap-2">
            <input type="hidden" name="id" value={paper.id} />
            <select
              name="readStatus"
              defaultValue={paper.readStatus}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="unread">待读</option>
              <option value="reading">读中</option>
              <option value="read">已读</option>
            </select>
            <Button type="submit" variant="outline" size="sm">
              更新
            </Button>
          </form>
        </div>

        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
          {paper.abstract ?? paper.notes ?? "暂无摘要或阅读笔记。"}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {paper.doi ? <span>DOI {paper.doi}</span> : null}
          {paper.arxivId ? <span>arXiv {paper.arxivId}</span> : null}
          <span>更新 {formatDate(paper.updatedAt)}</span>
          {paper.externalUrl ? (
            <a
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              href={paper.externalUrl}
            >
              <ExternalLink className="size-3" />
              原文链接
            </a>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-border/65 pt-3 md:flex-row md:items-center md:justify-between">
          <TagList value={paper.tags} />
          <div className="flex flex-wrap items-center gap-2">
            <CreateDialog title="编辑文献" label="编辑" icon={Edit3} wide>
              <PaperForm action={updatePaper} paper={paper} />
            </CreateDialog>
            <form action={deletePaper}>
              <input type="hidden" name="id" value={paper.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="size-4" />
                删除
              </Button>
            </form>
          </div>
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
            <option value="unread">待读</option>
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
