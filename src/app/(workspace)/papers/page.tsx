import Link from "next/link";
import {
  AlertCircle,
  Beaker,
  BookOpenCheck,
  BookOpenText,
  Clock3,
  Edit3,
  ExternalLink,
  FileText,
  LibraryBig,
  Lightbulb,
  NotebookPen,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  CheckCircle2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Paper, Prisma } from "@prisma/client";

import {
  createExperimentFromPaper,
  createLiteratureMatrixNote,
  createPaper,
  createReadingClosureNote,
  createReadingPlanNote,
  createReadingNoteFromPaper,
  createTaskFromPaper,
  deletePaper,
  syncZoteroPapers,
  updatePaper,
  updatePaperStatus,
  updatePaperStatuses,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDate, parseTags } from "@/lib/format";
import { getZoteroConfigStatus } from "@/lib/zotero";
import { EmptyState } from "@/components/shared/empty-state";
import { CaptureNotice } from "@/components/shared/capture-notice";
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
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    sync?: string;
    count?: string;
    fetched?: string;
    incremental?: string;
    limit?: string;
    message?: string;
    more?: string;
    scope?: string;
    since?: string;
    total?: string;
    version?: string;
    captured?: string;
    bulk?: string;
    bulkStatus?: string;
    closure?: string;
    matrix?: string;
    plan?: string;
  }>;
};

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PapersPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = valueOf(params.q)?.trim();
  const status = valueOf(params.status);
  const category = valueOf(params.category)?.trim();
  const sync = valueOf(params.sync);
  const syncedCount = Number(valueOf(params.count) ?? 0);
  const fetchedCount = Number(valueOf(params.fetched) ?? syncedCount);
  const incrementalSync = valueOf(params.incremental) === "true";
  const requestedLimit = Number(valueOf(params.limit) ?? 0);
  const syncMessage = valueOf(params.message);
  const syncMore = valueOf(params.more) === "true";
  const syncScope = valueOf(params.scope);
  const syncSince = valueOf(params.since);
  const syncTotal = valueOf(params.total);
  const syncVersion = valueOf(params.version);
  const captured = valueOf(params.captured);
  const bulk = valueOf(params.bulk);
  const bulkCount = Number(valueOf(params.count) ?? 0);
  const bulkStatus = valueOf(params.bulkStatus);
  const closure = valueOf(params.closure);
  const matrix = valueOf(params.matrix);
  const plan = valueOf(params.plan);
  const zotero = await getZoteroConfigStatus();
  const activeFilterCount = [q, status, category].filter(Boolean).length;
  const currentQuery = new URLSearchParams();
  if (q) currentQuery.set("q", q);
  if (status) currentQuery.set("status", status);
  if (category) currentQuery.set("category", category);
  const returnTo = currentQuery.size ? `/papers?${currentQuery.toString()}` : "/papers";

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

  const [papers, allCounts, categories, lastSyncedPaper, dailyReadingCandidates] = await Promise.all([
    prisma.paper.findMany({
      where,
      orderBy: [{ readStatus: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.paper.groupBy({ by: ["readStatus"], _count: true }),
    prisma.paper.groupBy({ by: ["category"], _count: true, orderBy: { _count: { category: "desc" } }, take: 8 }),
    prisma.paper.findFirst({
      where: { lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    }),
    prisma.paper.findMany({
      where: { readStatus: { in: ["reading", "unread"] } },
      orderBy: { updatedAt: "desc" },
      take: 18,
    }),
  ]);

  const lastSyncedAt = lastSyncedPaper?.lastSyncedAt;
  const unreadCount = countStatus(allCounts, "unread");
  const readingCount = countStatus(allCounts, "reading");
  const readCount = countStatus(allCounts, "read");
  const totalCount = unreadCount + readingCount + readCount;
  const readingStack = prioritizeReadingQueue(dailyReadingCandidates).slice(0, 3);
  const totalOpenReadingCount = readingCount + unreadCount;
  const visibleUnreadCount = papers.filter((paper) => paper.readStatus === "unread").length;
  const visibleReadingCount = papers.filter((paper) => paper.readStatus === "reading").length;
  const visibleNeedNoteCount = papers.filter(
    (paper) => paper.readStatus === "read" && !paper.notes?.trim(),
  ).length;
  const visibleClosureCount = papers.filter(
    (paper) => ["reading", "read"].includes(paper.readStatus) && !paper.notes?.trim(),
  ).length;
  const visibleNotedCount = papers.filter((paper) => paper.notes?.trim()).length;
  const readingRadarStatus = visibleReadingCount ? "reading" : visibleUnreadCount ? "unread" : undefined;

  return (
    <div className="grid gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="research-eyebrow">
                <LibraryBig className="size-3.5" />
                Zotero 阅读台
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                同步为主 · 手动兜底
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              文献不用重复录，重点放在读到哪一步。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
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
              <form action={createReadingPlanNote}>
                <input type="hidden" name="returnTo" value={returnTo} />
                {papers.slice(0, 12).map((paper) => (
                  <input key={paper.id} type="hidden" name="ids" value={paper.id} />
                ))}
                <SubmitButton variant="outline" disabled={!papers.length}>
                  <FileText className="size-4" />
                  整理阅读计划
                </SubmitButton>
              </form>
            </div>
          </div>

          <div className="flex min-h-64 flex-col justify-between rounded-2xl action-stack p-4 text-white shadow-[0_18px_36px_rgba(22,34,53,0.16)]">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-white/68">
                <BookOpenCheck className="size-3.5" />
                今日阅读栈
              </p>
              <div className="mt-4 grid gap-2.5">
                {readingStack.length ? (
                  readingStack.map((paper, index) => (
                    <ReadingStackItem
                      key={paper.id}
                      paper={paper}
                      index={`0${index + 1}`}
                    />
                  ))
                ) : (
                  <ReadingStackItem
                    index="01"
                    title={zotero.ready ? "同步 Zotero 后开始阅读" : "先连接 Zotero"}
                    detail={zotero.ready ? "当前筛选下没有待读文献" : "设置 API Key 和 Library ID"}
                  />
                )}
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-white/62">
              从全库待读/读中自动挑 3 篇，不受当前筛选影响；读完再沉淀成阅读笔记或组会素材。
            </p>
          </div>
        </div>
      </section>

      {readingStack.length ? (
        <section className="grid gap-3 rounded-2xl border border-border/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(240,247,247,0.78))] p-3 shadow-[0_10px_24px_rgba(27,42,56,0.032)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold hero-title">
                <BookOpenCheck className="size-4 text-primary" />
                三篇启动队列
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                先从 3 篇开始，避免 Zotero 同步后变成大列表压力。读出方法、对照或指标后再转实验/任务。
              </p>
            </div>
            <span className="w-fit rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
              全库待处理 {totalOpenReadingCount} 篇
            </span>
          </div>
          <div className="grid gap-2 lg:grid-cols-3">
            {readingStack.map((paper, index) => (
              <DailyReadingCard key={paper.id} paper={paper} index={index + 1} />
            ))}
          </div>
        </section>
      ) : null}

      {!zotero.ready ? (
        <ZoteroConnectionOnboarding />
      ) : null}

      <CaptureNotice kind={captured} />

      {sync === "success" ? (
        <SyncNotice
          tone="success"
          title="Zotero 同步完成"
          description={zoteroSyncSuccessDescription({
            count: syncedCount,
            fetched: fetchedCount,
            hasMore: syncMore,
            incremental: incrementalSync,
            limit: requestedLimit || zotero.syncLimit,
            since: syncSince,
            scope: syncScope,
            total: syncTotal,
            version: syncVersion,
          })}
        />
      ) : null}

      {sync === "error" ? (
        <SyncNotice
          tone="error"
          title="Zotero 同步失败"
          description={
            syncMessage ||
            "请检查 API Key、Library ID、库类型、Collection Key 和服务器网络。"
          }
        />
      ) : null}

      {bulk === "success" ? (
        <SyncNotice
          tone="success"
          title="阅读状态已批量更新"
          description={`已将 ${bulkCount} 篇文献标记为“${statusText(bulkStatus)}”。`}
        />
      ) : null}

      {bulk === "empty" ? (
        <SyncNotice
          tone="error"
          title="没有选中文献"
          description="先勾选要处理的文献，再批量更新阅读状态。"
        />
      ) : null}

      {plan === "empty" ? (
        <SyncNotice
          tone="error"
          title="没有可整理的文献"
          description="当前列表为空。先同步 Zotero、切换集合，或清除筛选后再生成阅读计划。"
        />
      ) : null}

      {matrix === "empty" ? (
        <SyncNotice
          tone="error"
          title="没有可对比的文献"
          description="当前列表为空。先同步 Zotero、切换集合，或清除筛选后再生成文献综述矩阵。"
        />
      ) : null}

      {closure === "empty" ? (
        <SyncNotice
          tone="error"
          title="没有需要收口的阅读"
          description="当前列表里没有读中/已读但缺少笔记的文献。可以先标记阅读状态，或清除筛选后再试。"
        />
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
              <ProgressLine label="待读" value={unreadCount} total={totalCount} />
              <ProgressLine label="读中" value={readingCount} total={totalCount} />
              <ProgressLine label="已读" value={readCount} total={totalCount} />
              <div className="rounded-xl border border-border/70 bg-white/70 p-3 text-xs text-muted-foreground">
                最近同步：{lastSyncedAt ? formatDate(lastSyncedAt) : "暂无"}
              </div>
              <div className="rounded-xl border border-border/70 bg-white/70 p-3 text-xs leading-5 text-muted-foreground">
                <p className="font-medium text-foreground">同步范围</p>
                <p className="mt-1">
                  {zotero.collectionKey ? `仅同步集合 ${zotero.collectionKey}` : "同步库内顶层文献"}
                </p>
                <p>单次最多 {zotero.syncLimit} 条，系统会自动分页读取。</p>
                <p className="mt-1">
                  同步完成后会提示 Zotero 当前范围总数，方便判断是否需要临时调高同步数量。
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="size-4 text-primary" />
                阅读雷达
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <ReadingRadarItem
                icon={Clock3}
                label="今天先读"
                value={`${visibleReadingCount + visibleUnreadCount} 篇`}
                detail="优先处理读中和待读，不让 Zotero 队列越积越厚"
                href={`/papers?${filterQuery({ q, status: readingRadarStatus, category })}`}
                tone={visibleReadingCount ? "blue" : visibleUnreadCount ? "warm" : "quiet"}
              />
              <ReadingRadarItem
                icon={NotebookPen}
                label="读后补笔记"
                value={`${visibleNeedNoteCount} 篇`}
                detail="已读但没有沉淀笔记，组会和写作时很难再找回"
                href={`/papers?${filterQuery({ q, status: "read", category })}`}
                tone={visibleNeedNoteCount ? "warm" : "quiet"}
              />
              <ReadingRadarItem
                icon={FileText}
                label="可沉淀素材"
                value={`${visibleNotedCount} 篇`}
                detail="已有笔记的文献，可以进入实验草稿、组会或论文写作"
                href="/notes?folder=文献"
                tone={visibleNotedCount ? "green" : "quiet"}
              />
              <form action={createReadingClosureNote} className="pt-1">
                <input type="hidden" name="returnTo" value={returnTo} />
                {papers
                  .filter((paper) => ["reading", "read"].includes(paper.readStatus) && !paper.notes?.trim())
                  .slice(0, 16)
                  .map((paper) => (
                    <input key={paper.id} type="hidden" name="ids" value={paper.id} />
                  ))}
                <SubmitButton variant="outline" className="w-full" disabled={!visibleClosureCount}>
                  <NotebookPen className="size-3.5" />
                  生成阅读收口清单
                </SubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Search className="size-4 text-primary" />
                快捷视图
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <QuickStatusLink label="全部文献" count={totalCount} statusValue="" currentStatus={status} q={q} category={category} />
              <QuickStatusLink label="待读队列" count={unreadCount} statusValue="unread" currentStatus={status} q={q} category={category} />
              <QuickStatusLink label="正在读" count={readingCount} statusValue="reading" currentStatus={status} q={q} category={category} />
              <QuickStatusLink label="已读回顾" count={readCount} statusValue="read" currentStatus={status} q={q} category={category} />
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>常用集合</CardTitle>
                {category ? (
                  <Link
                    href={status || q ? `/papers?${filterQuery({ q, status })}` : "/papers"}
                    className="text-xs font-medium text-primary"
                  >
                    清除
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Link
                href={status || q ? `/papers?${filterQuery({ q, status })}` : "/papers"}
                className={
                  category
                    ? "flex items-center justify-between rounded-xl border border-border/72 bg-white/70 px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/25 hover:bg-white"
                    : "flex items-center justify-between rounded-xl border border-primary/25 bg-[#eef3fb] px-3 py-2 text-sm font-medium text-primary"
                }
              >
                <span>全部集合</span>
                <span className="text-xs">{unreadCount + readingCount + readCount}</span>
              </Link>
              {categories.length ? (
                categories.map((item) => (
                  <Link
                    key={item.category}
                    href={`/papers?${filterQuery({ q, status, category: item.category })}`}
                    className={
                      item.category === category
                        ? "flex items-center justify-between rounded-xl border border-primary/25 bg-[#eef3fb] px-3 py-2 text-sm font-medium text-primary"
                        : "flex items-center justify-between soft-tile rounded-xl px-3 py-2 text-sm transition hover:border-primary/25 hover:bg-white"
                    }
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

          <div className="flex flex-col gap-2 rounded-2xl border border-border/72 bg-white/78 p-3 shadow-[0_10px_24px_rgba(34,48,71,0.04)] md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">当前列表 {papers.length} 篇</span>
              {activeFilterCount ? (
                <Link
                  href="/papers"
                  className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/82 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/25 hover:text-primary"
                >
                  <X className="size-3" />
                  清除 {activeFilterCount} 个筛选
                </Link>
              ) : (
                <span className="rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                  未筛选
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={createLiteratureMatrixNote} className="contents">
                <input type="hidden" name="returnTo" value={returnTo} />
                {papers.slice(0, 12).map((paper) => (
                  <input key={paper.id} type="hidden" name="ids" value={paper.id} />
                ))}
                <SubmitButton variant="outline" className="w-fit" disabled={!papers.length}>
                  <BookOpenText className="size-3.5" />
                  生成综述矩阵
                </SubmitButton>
              </form>
              <form action={createReadingPlanNote} className="contents">
                <input type="hidden" name="returnTo" value={returnTo} />
                {papers.slice(0, 12).map((paper) => (
                  <input key={paper.id} type="hidden" name="ids" value={paper.id} />
                ))}
                <SubmitButton variant="outline" className="w-fit" disabled={!papers.length}>
                  <FileText className="size-3.5" />
                  生成阅读计划
                </SubmitButton>
              </form>
              <form id="paper-bulk-form" action={updatePaperStatuses} className="flex flex-wrap gap-2">
                <input type="hidden" name="returnTo" value={returnTo} />
                <select
                  name="readStatus"
                  defaultValue="reading"
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="unread">标为待读</option>
                  <option value="reading">标为读中</option>
                  <option value="read">标为已读</option>
                </select>
                <SubmitButton variant="outline" className="w-fit">
                  批量更新
                </SubmitButton>
              </form>
            </div>
          </div>

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

function SyncNotice({
  tone,
  title,
  description,
}: {
  tone: "success" | "error";
  title: string;
  description: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <Card
      className={
        tone === "success"
          ? "border-emerald-200 bg-[#eefaf4] shadow-sm"
          : "border-rose-200 bg-[#fff1f2] shadow-sm"
      }
    >
      <CardContent className="flex flex-col gap-3 py-4 text-sm md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <span
            className={
              tone === "success"
                ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"
                : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700"
            }
          >
            <Icon className="size-4" />
          </span>
          <div>
            <p className={tone === "success" ? "font-medium text-emerald-950" : "font-medium text-rose-950"}>
              {title}
            </p>
            <p className={tone === "success" ? "mt-1 text-emerald-900/80" : "mt-1 text-rose-900/80"}>
              {description}
            </p>
          </div>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/papers">
          关闭提示
        </Link>
      </CardContent>
    </Card>
  );
}

function countStatus(
  counts: Array<{ readStatus: string; _count: number }>,
  status: string,
) {
  return counts.find((item) => item.readStatus === status)?._count ?? 0;
}

function statusText(value: string | undefined) {
  if (value === "reading") return "读中";
  if (value === "read") return "已读";
  return "待读";
}

function prioritizeReadingQueue(papers: Paper[]) {
  return [...papers].sort((left, right) => {
    const statusRank =
      (left.readStatus === "reading" ? 0 : 1) - (right.readStatus === "reading" ? 0 : 1);
    if (statusRank !== 0) return statusRank;

    const noteRank = (left.notes?.trim() ? 1 : 0) - (right.notes?.trim() ? 1 : 0);
    if (noteRank !== 0) return noteRank;

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
}

function zoteroSyncSuccessDescription({
  count,
  fetched,
  hasMore,
  incremental,
  limit,
  since,
  scope,
  total,
  version,
}: {
  count: number;
  fetched: number;
  hasMore: boolean;
  incremental: boolean;
  limit: number;
  since?: string;
  scope?: string;
  total?: string;
  version?: string;
}) {
  if (count <= 0) {
    return incremental
      ? "Zotero 增量同步完成，当前范围没有新的或更新过的文献。"
      : "Zotero 返回了 0 条可同步文献。可以检查 Collection Key、同步数量或 Zotero 集合内容。";
  }

  const pieces = [
    incremental ? `增量同步 ${count} 条文献` : `已同步 ${count} 条文献`,
    fetched !== count ? `读取到 ${fetched} 条 Zotero 条目` : null,
    scope ? `范围：${scope}` : null,
    since ? `从版本 ${since} 后更新` : null,
    version ? `当前版本 ${version}` : null,
    total ? `Zotero 当前范围共 ${total} 条` : null,
    hasMore ? zoteroMoreHint(limit) : null,
  ].filter((item): item is string => Boolean(item));

  return `${pieces.join("；")}。重复条目会自动更新，不会重复创建。`;
}

function zoteroMoreHint(limit: number) {
  if (limit >= 500) {
    return "还有更多条目未拉取，可先填写 Collection Key 分批同步";
  }

  return `还有更多条目未拉取，可在设置中心把同步数量调高到 ${limit} 以上`;
}

function filterQuery(values: { q?: string; status?: string; category?: string }) {
  const params = new URLSearchParams();
  if (values.q) params.set("q", values.q);
  if (values.status) params.set("status", values.status);
  if (values.category) params.set("category", values.category);
  return params.toString();
}

function ReadingStackItem({
  detail,
  index,
  paper,
  title,
}: {
  detail?: string;
  index: string;
  paper?: Paper;
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-white/50">{index}</span>
        <span className="h-px flex-1 bg-white/12" />
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-white">
        {paper?.title ?? title}
      </p>
      <p className="mt-1 line-clamp-1 text-xs text-white/58">
        {paper
          ? `${statusText(paper.readStatus)} · ${paper.year ?? "年份未知"} · ${paper.category || "未分类"}`
          : detail}
      </p>
    </div>
  );
}

function DailyReadingCard({ paper, index }: { paper: Paper; index: number }) {
  const authors = parseTags(paper.authors).slice(0, 2).join(", ") || "作者未知";
  const isReading = paper.readStatus === "reading";

  return (
    <Card className="border-border/72 bg-white/86 shadow-[0_8px_22px_rgba(27,42,56,0.038)]">
      <CardContent className="grid h-full gap-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-xs font-semibold text-primary">0{index}</span>
          <span
            className={
              isReading
                ? "rounded-full border border-[#c9e0ea] bg-[#eef6f7] px-2 py-0.5 text-[11px] font-medium text-primary"
                : "rounded-full border border-[#edd8a5] bg-[#fff7df] px-2 py-0.5 text-[11px] font-medium text-[#7a5a2f]"
            }
          >
            {statusText(paper.readStatus)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-6">{paper.title}</p>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {authors} · {paper.year ?? "年份未知"} · {paper.category || "未分类"}
          </p>
        </div>
        <p className="line-clamp-2 rounded-xl border border-[#d5e4e8] bg-[#f5fafb] px-3 py-2 text-xs leading-5 text-muted-foreground">
          {paperActionReason(paper)}
        </p>
        <div className="mt-auto flex flex-wrap gap-2">
          {!isReading ? (
            <form action={updatePaperStatus}>
              <input type="hidden" name="id" value={paper.id} />
              <input type="hidden" name="readStatus" value="reading" />
              <Button type="submit" variant="outline" size="sm">
                <BookOpenCheck className="size-3.5" />
                标为读中
              </Button>
            </form>
          ) : null}
          <form action={createReadingNoteFromPaper}>
            <input type="hidden" name="id" value={paper.id} />
            <Button type="submit" variant={isReading ? "default" : "outline"} size="sm">
              <FileText className="size-3.5" />
              阅读笔记
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickStatusLink({
  label,
  count,
  statusValue,
  currentStatus,
  q,
  category,
}: {
  label: string;
  count: number;
  statusValue: string;
  currentStatus?: string;
  q?: string;
  category?: string;
}) {
  const active = statusValue ? currentStatus === statusValue : !currentStatus;
  const href = `/papers?${filterQuery({ q, status: statusValue || undefined, category })}`;

  return (
    <Link
      href={href === "/papers?" ? "/papers" : href}
      className={
        active
          ? "flex items-center justify-between rounded-xl border border-primary/25 bg-[#eef4fb] px-3 py-2 text-sm font-medium text-primary"
          : "flex items-center justify-between soft-tile rounded-xl px-3 py-2 text-sm transition hover:border-primary/25 hover:bg-white"
      }
    >
      <span>{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </Link>
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

function ReadingRadarItem({
  icon: Icon,
  label,
  value,
  detail,
  href,
  tone = "blue",
}: {
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
      href={href === "/papers?" ? "/papers" : href}
      className="group grid gap-3 rounded-xl border border-border/70 bg-white/72 p-3 transition hover:border-primary/25 hover:bg-white sm:grid-cols-[auto_1fr_auto] sm:items-center xl:grid-cols-[auto_1fr]"
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs font-medium text-primary">{value}</span>
        </span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
          {detail}
        </span>
      </span>
    </Link>
  );
}

function ZoteroConnectionOnboarding() {
  const steps = [
    {
      title: "先在 Zotero 新建只读 Key",
      detail: "只勾选读取文献库权限。PDF 和附件仍留在 Zotero，不会上传到研途 Hub。",
    },
    {
      title: "在设置中心填 Library ID",
      detail: "个人库填 userID；群组库填 group ID，并把类型切到“群组”。",
    },
    {
      title: "回到文献页同步一次",
      detail: "同步后这里会自动出现三篇启动队列，先读 3 篇，不被长列表拖住。",
    },
  ];

  return (
    <section className="grid gap-3 rounded-2xl border border-[#ead8ac] bg-[linear-gradient(135deg,rgba(255,249,234,0.96),rgba(239,247,247,0.84))] p-4 shadow-[0_10px_24px_rgba(75,56,28,0.045)]">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#6f542c]">
            <AlertCircle className="size-4" />
            Zotero 还没接上，先别手动录一堆文献
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f542c]/86">
            文献源头建议继续放在 Zotero。研途 Hub 只负责同步条目、安排阅读、生成笔记和转实验线索，避免重复维护两套文献库。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link className={buttonVariants({ variant: "default" })} href="/settings">
            <Settings className="size-4" />
            去设置连接
          </Link>
          <a
            className={buttonVariants({ variant: "outline" })}
            href="https://www.zotero.org/settings/keys/new"
            target="_blank"
            rel="noreferrer"
          >
            创建 Zotero Key
          </a>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-xl border border-white/72 bg-white/72 p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg border border-[#ead8ac] bg-[#fff8e8] font-mono text-[11px] font-semibold text-[#7a5a2f]">
                0{index + 1}
              </span>
              <p className="text-sm font-medium text-[var(--workspace-title)]">{step.title}</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{step.detail}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-[#d5e4e8] bg-white/62 px-3 py-2 text-xs leading-5 text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>临时网页、导师转发材料、还没入库的预印本，才适合用“补录文献”。</p>
        <CreateDialog
          title="手动补录文献"
          description="只给临时材料使用，正式文献建议回到 Zotero 管理。"
          label="临时补录"
          icon={Plus}
          wide
        >
          <PaperForm action={createPaper} />
        </CreateDialog>
      </div>
    </section>
  );
}

function PaperCard({ paper }: { paper: Paper }) {
  const authors = parseTags(paper.authors);
  const nextAction = paper.readStatus === "read" ? "回顾笔记" : paper.readStatus === "reading" ? "继续阅读" : "开始阅读";
  const actionReason = paperActionReason(paper);

  return (
    <Card className="workbench-card">
      <CardContent className="grid gap-3 py-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="flex min-w-0 gap-3">
            <input
              form="paper-bulk-form"
              type="checkbox"
              name="ids"
              value={paper.id}
              aria-label={`选择文献：${paper.title}`}
              className="mt-1 size-4 rounded border-border text-primary accent-[var(--primary)]"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={paper.readStatus} />
                <span className="rounded-md border bg-white/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {paper.category || "未分类"}
                </span>
                <span className="rounded-md border border-[#d8e5ee] bg-[#eef4fb] px-1.5 py-0.5 text-[11px] text-[#365a7d]">
                  {nextAction}
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
          </div>
          <form action={updatePaperStatus} className="flex flex-wrap gap-2 lg:justify-end">
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

        <div className="rounded-xl border border-[#d5e4e8] bg-[#f5fafb] p-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#d5e4e8] bg-white/72 text-primary">
              <BookOpenCheck className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{nextAction}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{actionReason}</p>
            </div>
          </div>
        </div>

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
            <form action={createReadingNoteFromPaper}>
              <input type="hidden" name="id" value={paper.id} />
              <Button type="submit" variant="outline" size="sm">
                <FileText className="size-4" />
                阅读笔记
              </Button>
            </form>
            <form action={createExperimentFromPaper}>
              <input type="hidden" name="id" value={paper.id} />
              <Button type="submit" variant="outline" size="sm">
                <Beaker className="size-4" />
                转实验
              </Button>
            </form>
            <form action={createTaskFromPaper}>
              <input type="hidden" name="id" value={paper.id} />
              <Button type="submit" variant="outline" size="sm">
                <Lightbulb className="size-4" />
                待验证
              </Button>
            </form>
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

function paperActionReason(paper: Paper) {
  if (paper.readStatus === "unread") {
    return "先读摘要、方法和关键图表；如果发现可复现方法，直接转成实验草稿。";
  }

  if (paper.readStatus === "reading") {
    return "这篇已经开始读了，优先收尾；读出方法、对照或指标后可生成阅读笔记或实验草稿。";
  }

  if (!paper.notes?.trim()) {
    return "已经标为已读，但还没有留下可回顾笔记；先补问题、方法抓手和可复现实验线索。";
  }

  return "已有阅读沉淀，可以回流到实验设计、组会讨论、综述或论文草稿。";
}

function PaperForm({
  action,
  paper,
}: {
  action: (formData: FormData) => Promise<void>;
  paper?: Paper;
}) {
  return (
    <form action={action} className="grid gap-4">
      {paper ? <input type="hidden" name="id" value={paper.id} /> : null}

      <section className="rounded-2xl border border-[#d8e7ea] bg-[linear-gradient(135deg,rgba(239,247,247,0.92),rgba(255,250,238,0.72))] p-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/82 text-primary shadow-sm">
            <BookOpenText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <Field label="文献标题">
              <Input
                name="title"
                required
                defaultValue={paper?.title ?? ""}
                placeholder="粘贴标题即可，后续同步 Zotero 后可再完善"
                className="h-10 bg-white/84 text-base font-medium"
              />
            </Field>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Zotero 是主文献库。这里适合先收住网页、预印本、导师临时发来的材料。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border/70 bg-white/72 p-3 md:grid-cols-[1fr_8rem_10rem]">
        <Field label="作者">
          <Input
            name="authors"
            placeholder="逗号分隔，可留空"
            defaultValue={parseTags(paper?.authors).join(", ")}
            className="h-9 bg-white/84"
          />
        </Field>
        <Field label="年份">
          <Input name="year" type="number" defaultValue={paper?.year ?? ""} className="h-9 bg-white/84" />
        </Field>
        <Field label="阅读状态">
          <select
            name="readStatus"
            defaultValue={paper?.readStatus ?? "unread"}
            className="h-9 rounded-lg border bg-white/84 px-2 text-sm"
          >
            <option value="unread">待读</option>
            <option value="reading">读中</option>
            <option value="read">已读</option>
          </select>
        </Field>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border/70 bg-white/72 p-3 md:grid-cols-2">
        <Field label="外部链接">
          <Input
            name="externalUrl"
            defaultValue={paper?.externalUrl ?? ""}
            placeholder="论文页、arXiv、期刊页或资料链接"
            className="h-9 bg-white/84"
          />
        </Field>
        <Field label="集合 / 分类">
          <Input
            name="category"
            defaultValue={paper?.category ?? "inbox"}
            placeholder="例如：inbox / 综述 / 方法"
            className="h-9 bg-white/84"
          />
        </Field>
        <Field label="来源">
          <Input
            name="journal"
            defaultValue={paper?.journal ?? ""}
            placeholder="期刊、会议或来源，可留空"
            className="h-9 bg-white/84"
          />
        </Field>
        <Field label="DOI">
          <Input
            name="doi"
            defaultValue={paper?.doi ?? ""}
            placeholder="有 DOI 再填"
            className="h-9 bg-white/84"
          />
        </Field>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border/70 bg-white/72 p-3">
        <Field label="标签">
          <Input
            name="tags"
            defaultValue={parseTags(paper?.tags).join(", ")}
            placeholder="例如：综述, baseline, 待读"
            className="h-9 bg-white/84"
          />
        </Field>
        <Field label="为什么要读">
          <Textarea
            name="notes"
            rows={4}
            defaultValue={paper?.notes ?? ""}
            placeholder="写一句问题、方法抓手或和当前课题的关系。"
            className="bg-white/84"
          />
        </Field>
        <Field label="摘要 / 关键摘录">
          <Textarea
            name="abstract"
            rows={4}
            defaultValue={paper?.abstract ?? ""}
            placeholder="可粘贴摘要，也可以先留空，读完后再补。"
            className="bg-white/84"
          />
        </Field>
      </section>

      <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-white/72 p-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs leading-5 text-muted-foreground">
          少量临时材料才需要手动补录；正式文献建议回到 Zotero 管理。
        </p>
        <SubmitButton>{paper ? "保存文献" : "添加文献"}</SubmitButton>
      </div>
    </form>
  );
}
