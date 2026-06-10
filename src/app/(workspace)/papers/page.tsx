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
  const literatureMatrixPapers = papers.slice(0, 12);
  const readingClosurePapers = papers
    .filter((paper) => ["reading", "read"].includes(paper.readStatus) && !paper.notes?.trim())
    .slice(0, 16);
  const literatureContextCount = papers.filter((paper) => paper.notes?.trim() || paper.abstract?.trim()).length;
  const literatureCollectionCount = new Set(
    papers.map((paper) => paper.category?.trim()).filter((item): item is string => Boolean(item)),
  ).size;
  const verificationPapers = prioritizeVerificationPapers(papers).slice(0, 4);

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
              {zotero.ready ? (
                <form action={syncZoteroPapers}>
                  <SubmitButton variant="default">
                    <RefreshCw className="size-4" />
                    同步 Zotero
                  </SubmitButton>
                </form>
              ) : (
                <Link className={buttonVariants({ variant: "default" })} href="/settings">
                  <Settings className="size-4" />
                  接上 Zotero
                </Link>
              )}
              {readingStack.length ? (
                <form action={createReadingPlanNote}>
                  <input type="hidden" name="returnTo" value={returnTo} />
                  {readingStack.map((paper) => (
                    <input key={paper.id} type="hidden" name="ids" value={paper.id} />
                  ))}
                  <SubmitButton variant="outline">
                    <FileText className="size-4" />
                    生成三篇计划
                  </SubmitButton>
                </form>
              ) : null}
              {zotero.ready ? (
                <Link className={buttonVariants({ variant: "outline" })} href="/settings">
                  <Settings className="size-4" />
                  连接设置
                </Link>
              ) : null}
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-fit rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
                全库待处理 {totalOpenReadingCount} 篇
              </span>
              <form action={createReadingPlanNote}>
                <input type="hidden" name="returnTo" value={returnTo} />
                {readingStack.map((paper) => (
                  <input key={paper.id} type="hidden" name="ids" value={paper.id} />
                ))}
                <SubmitButton variant="outline" className="w-fit bg-white/74">
                  <FileText className="size-3.5" />
                  生成三篇计划
                </SubmitButton>
              </form>
            </div>
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

      {papers.length ? (
        <LiteratureSynthesisBoard
          closurePapers={readingClosurePapers}
          collectionCount={literatureCollectionCount}
          contextCount={literatureContextCount}
          matrixPapers={literatureMatrixPapers}
          returnTo={returnTo}
          totalPapers={papers.length}
        />
      ) : null}

      {verificationPapers.length ? (
        <LiteratureExperimentBridge papers={verificationPapers} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.28fr_0.72fr]">
        <aside className="grid content-start gap-4">
          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <BookOpenCheck className="size-4 text-primary" />
                Zotero 到阅读
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <ReadingSourcePanel
                lastSyncedAt={lastSyncedAt}
                papersCount={totalCount}
                ready={zotero.ready}
              />
              <div className="grid gap-2 rounded-xl border border-border/70 bg-white/62 p-3 text-xs leading-5 text-muted-foreground">
                <p className="font-medium text-foreground">今天只走三步</p>
                <div className="grid gap-2">
                  <ReadingFlowStep index="01" title="同步 Zotero" detail="正式文献留在 Zotero，不重复维护两套库。" />
                  <ReadingFlowStep index="02" title="只读三篇" detail="优先处理读中和待读，避免长列表压力。" />
                  <ReadingFlowStep index="03" title="留下抓手" detail="读出问题、方法、对照或可复现实验线索。" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="size-4 text-primary" />
                阅读状态
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <ProgressLine label="待读" value={unreadCount} total={totalCount} />
              <ProgressLine label="读中" value={readingCount} total={totalCount} />
              <ProgressLine label="已读" value={readCount} total={totalCount} />
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
                    : "flex items-center justify-between rounded-xl border border-primary/25 bg-[#eef4eb] px-3 py-2 text-sm font-medium text-primary"
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
                        ? "flex items-center justify-between rounded-xl border border-primary/25 bg-[#eef4eb] px-3 py-2 text-sm font-medium text-primary"
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

function prioritizeVerificationPapers(papers: Paper[]) {
  return [...papers]
    .map((paper) => ({ paper, score: verificationPaperScore(paper) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.paper.updatedAt.getTime() - left.paper.updatedAt.getTime();
    })
    .map((item) => item.paper);
}

function verificationPaperScore(paper: Paper) {
  const text = `${paper.title} ${paper.abstract ?? ""} ${paper.notes ?? ""} ${paper.tags} ${paper.category}`.toLowerCase();
  const signalScore = [
    /method|algorithm|baseline|benchmark|dataset|code|github|reproduc|ablation|experiment/i,
    /方法|算法|模型|基线|对照|数据集|代码|复现|消融|实验|指标|误差|精度|准确率|性能/i,
  ].reduce((score, pattern) => score + (pattern.test(text) ? 2 : 0), 0);
  const statusScore = paper.readStatus === "reading" ? 2 : paper.readStatus === "read" ? 1 : 0;
  const noteScore = paper.notes?.trim() ? 1 : 0;

  return signalScore + statusScore + noteScore;
}

function verificationReason(paper: Paper) {
  const text = `${paper.title} ${paper.abstract ?? ""} ${paper.notes ?? ""} ${paper.tags} ${paper.category}`.toLowerCase();
  const reasons = [
    { label: "方法/算法", pattern: /method|algorithm|方法|算法|模型/i },
    { label: "对照/基线", pattern: /baseline|benchmark|ablation|基线|对照|消融/i },
    { label: "数据/指标", pattern: /dataset|metric|accuracy|rmse|mae|数据集|指标|准确率|精度|误差/i },
    { label: "代码/复现", pattern: /code|github|reproduc|代码|复现/i },
  ];
  const matched = reasons.filter((reason) => reason.pattern.test(text)).map((reason) => reason.label);

  return matched.length ? matched.slice(0, 2).join(" / ") : "可验证线索";
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

function ReadingSourcePanel({
  lastSyncedAt,
  papersCount,
  ready,
}: {
  lastSyncedAt?: Date | null;
  papersCount: number;
  ready: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-[#d5e4e8] bg-[#f5fafb]/86 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--workspace-title)]">
            {ready ? "Zotero 已作为文献源头" : "先接 Zotero，不手动搬库"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {ready
              ? `库内已有 ${papersCount} 篇；最近同步 ${lastSyncedAt ? formatDate(lastSyncedAt) : "暂无记录"}。`
              : "正式文献继续放在 Zotero。这里同步条目后，只负责安排阅读和沉淀笔记。"}
          </p>
        </div>
        <span
          className={
            ready
              ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
              : "rounded-full border border-[#ead8ac] bg-[#fff8e8] px-2 py-0.5 text-[11px] font-medium text-[#7a5a2f]"
          }
        >
          {ready ? "已连接" : "待连接"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {ready ? (
          <form action={syncZoteroPapers}>
            <SubmitButton variant="outline" className="h-8 bg-white/78 px-2.5 text-xs">
              <RefreshCw className="size-3.5" />
              同步
            </SubmitButton>
          </form>
        ) : (
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/settings">
            <Settings className="size-3.5" />
            去连接
          </Link>
        )}
        <CreateDialog
          title="临时材料补录"
          description="只给导师临时转发、网页预印本或还没来得及进 Zotero 的材料使用。"
          label="临时补录"
          icon={Plus}
          wide
        >
          <PaperForm action={createPaper} />
        </CreateDialog>
      </div>
    </div>
  );
}

function ReadingFlowStep({
  detail,
  index,
  title,
}: {
  detail: string;
  index: string;
  title: string;
}) {
  return (
    <div className="flex gap-2 rounded-lg border border-border/60 bg-white/64 p-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-[#d8e2d6] bg-[#eef4eb] font-mono text-[11px] font-semibold text-primary">
        {index}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-[var(--workspace-title)]">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{detail}</span>
      </span>
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
      title: "建只读 Key",
      detail: "只勾选读取权限。PDF、附件和正式引用仍留在 Zotero。",
    },
    {
      title: "填 Library ID",
      detail: "个人库填 userID；群组库填 group ID，库类型选“群组”。",
    },
    {
      title: "同步后只读三篇",
      detail: "同步后自动生成三篇启动队列，先读 3 篇，不被长列表拖住。",
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
        <p>
          同步前只做一件事：接上 Zotero。临时网页、导师转发材料、还没入库的预印本才用“临时材料”。
        </p>
        <CreateDialog
          title="临时材料补录"
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

function LiteratureSynthesisBoard({
  closurePapers,
  collectionCount,
  contextCount,
  matrixPapers,
  returnTo,
  totalPapers,
}: {
  closurePapers: Paper[];
  collectionCount: number;
  contextCount: number;
  matrixPapers: Paper[];
  returnTo: string;
  totalPapers: number;
}) {
  const signals = [
    {
      label: "当前范围",
      value: `${totalPapers} 篇`,
      detail: collectionCount ? `${collectionCount} 个 Zotero 集合/分类` : "还没有集合分类",
      icon: LibraryBig,
      tone: "paper" as const,
    },
    {
      label: "可对比",
      value: `${matrixPapers.length} 篇`,
      detail: "进入综述矩阵，不自动补事实",
      icon: BookOpenText,
      tone: "matrix" as const,
    },
    {
      label: "待收口",
      value: `${closurePapers.length} 篇`,
      detail: "读中/已读但还缺阅读笔记",
      icon: NotebookPen,
      tone: "closure" as const,
    },
    {
      label: "有上下文",
      value: `${contextCount} 篇`,
      detail: "已有摘要或阅读备注，可进入写作",
      icon: FileText,
      tone: "context" as const,
    },
  ];

  return (
    <section className="literature-synthesis overflow-hidden rounded-3xl border border-border/60 p-4 shadow-[0_18px_42px_rgba(27,42,56,0.052)]">
      <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr] xl:items-stretch">
        <div className="literature-synthesis-lead rounded-2xl border border-white/70 p-4">
          <span className="research-eyebrow">
            <BookOpenText className="size-3.5" />
            综述合成台
          </span>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight hero-title">
            不再从一长串文献里硬写 related work。
          </h2>
          <p className="mt-3 text-sm leading-6 hero-copy">
            Zotero 管条目，研途 Hub 只把当前筛选范围压缩成两种写作前动作：先补读后抓手，
            再生成可人工填写的综述矩阵。
          </p>
          <div className="mt-4 grid gap-2 text-xs leading-5 text-muted-foreground">
            <ResearchProofLine source="Zotero" text="文献条目、集合和标签仍以 Zotero 为源头。" />
            <ResearchProofLine source="Obsidian" text="阅读笔记要能回到写作材料和双链上下文。" />
            <ResearchProofLine source="OSF/ELN" text="综述线索要能继续流向课题阶段和实验复现。" />
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {signals.map((signal) => (
              <LiteratureSignalCard key={signal.label} {...signal} />
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/72 bg-white/64 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold hero-title">
                    <NotebookPen className="size-4 text-primary" />
                    先补读后抓手
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    已读/读中却没留下笔记的文献，最容易在组会和综述前丢失价值。
                  </p>
                </div>
                <span className="rounded-full border border-[#ead9ad] bg-[#fff8e7] px-2 py-0.5 text-xs font-semibold text-[#765a23]">
                  {closurePapers.length}
                </span>
              </div>
              <form action={createReadingClosureNote} className="mt-3">
                <input type="hidden" name="returnTo" value={returnTo} />
                {closurePapers.map((paper) => (
                  <input key={paper.id} type="hidden" name="ids" value={paper.id} />
                ))}
                <SubmitButton variant="outline" className="w-full bg-white/72" disabled={!closurePapers.length}>
                  <NotebookPen className="size-3.5" />
                  生成阅读收口清单
                </SubmitButton>
              </form>
            </div>

            <div className="rounded-2xl border border-white/72 bg-white/64 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold hero-title">
                    <BookOpenText className="size-4 text-primary" />
                    再生成综述矩阵
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    只生成结构化表格，问题、方法、数据和可复用点仍由你核对填写。
                  </p>
                </div>
                <span className="rounded-full border border-[#d3e2ee] bg-[#eef6fb] px-2 py-0.5 text-xs font-semibold text-[#365a7d]">
                  {matrixPapers.length}
                </span>
              </div>
              <form action={createLiteratureMatrixNote} className="mt-3">
                <input type="hidden" name="returnTo" value={returnTo} />
                {matrixPapers.map((paper) => (
                  <input key={paper.id} type="hidden" name="ids" value={paper.id} />
                ))}
                <SubmitButton variant="outline" className="w-full bg-white/72" disabled={!matrixPapers.length}>
                  <FileText className="size-3.5" />
                  生成综述矩阵
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResearchProofLine({ source, text }: { source: string; text: string }) {
  return (
    <div className="flex gap-2 rounded-xl border border-white/64 bg-white/54 px-3 py-2">
      <span className="shrink-0 font-mono text-[11px] font-semibold text-primary">{source}</span>
      <span>{text}</span>
    </div>
  );
}

function LiteratureSignalCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: "closure" | "context" | "matrix" | "paper";
  value: string;
}) {
  const toneClass = {
    closure: "border-[#ead9ad] bg-[#fff8e7] text-[#765a23]",
    context: "border-[#d5e8d6] bg-[#eef8ed] text-[#3f6c4d]",
    matrix: "border-[#d3e2ee] bg-[#eef6fb] text-[#365a7d]",
    paper: "border-[#d5e4e8] bg-[#eef6f4] text-primary",
  }[tone];

  return (
    <div className="literature-signal-card">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-sm font-semibold hero-title">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function LiteratureExperimentBridge({ papers }: { papers: Paper[] }) {
  const primary = papers[0];

  return (
    <section className="literature-experiment-bridge overflow-hidden rounded-3xl border border-border/60 p-4 shadow-[0_18px_42px_rgba(27,42,56,0.048)]">
      <div className="grid gap-4 xl:grid-cols-[0.32fr_0.68fr] xl:items-stretch">
        <div className="literature-experiment-bridge-lead rounded-2xl border border-white/70 p-4">
          <span className="research-eyebrow">
            <Beaker className="size-3.5" />
            文献到实验桥
          </span>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight hero-title">
            读到可复现方法时，不要让它停在文献列表里。
          </h2>
          <p className="mt-3 text-sm leading-6 hero-copy">
            Zotero 负责收藏和标签，研途 Hub 只把有方法、代码、数据、对照或指标线索的文献推到验证入口。
            能复现就转实验；还不确定就先拆成待验证任务。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">可验证候选</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight hero-title">{papers.length}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/58 p-3">
              <p className="text-xs text-muted-foreground">优先处理</p>
              <p className="mt-1 line-clamp-1 text-base font-semibold hero-title">
                {primary ? verificationReason(primary) : "暂无"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-3">
            <BridgeStep
              icon={BookOpenText}
              index="01"
              title="读方法"
              detail="只抓研究问题、关键变量、对照和指标。"
            />
            <BridgeStep
              icon={Beaker}
              index="02"
              title="转验证"
              detail="可复现方法直接生成实验草稿。"
            />
            <BridgeStep
              icon={Lightbulb}
              index="03"
              title="留待办"
              detail="不确定时先拆成待验证任务。"
            />
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            {papers.map((paper) => (
              <VerificationPaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BridgeStep({
  detail,
  icon: Icon,
  index,
  title,
}: {
  detail: string;
  icon: LucideIcon;
  index: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-white/72 bg-white/62 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl border border-[#d5e4e8] bg-[#eef6f7] text-primary">
          <Icon className="size-4" />
        </span>
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">{index}</span>
      </div>
      <p className="mt-3 text-sm font-semibold hero-title">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function VerificationPaperCard({ paper }: { paper: Paper }) {
  const authors = parseTags(paper.authors).slice(0, 2).join(", ") || "作者未知";

  return (
    <div className="rounded-2xl border border-white/72 bg-white/66 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full border border-[#d5e4e8] bg-[#eef6f7] px-2 py-0.5 text-[11px] font-medium text-primary">
          {verificationReason(paper)}
        </span>
        <StatusBadge value={paper.readStatus} />
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 hero-title">{paper.title}</h3>
      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
        {authors} · {paper.year ?? "年份未知"} · {paper.category || "未分类"}
      </p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {paper.notes?.trim() || paper.abstract?.trim() || "先从摘要、方法和关键图表里找可验证点。"}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <form action={createExperimentFromPaper}>
          <input type="hidden" name="id" value={paper.id} />
          <SubmitButton variant="outline" size="sm" className="w-full bg-white/74">
            <Beaker className="size-3.5" />
            转实验
          </SubmitButton>
        </form>
        <form action={createTaskFromPaper}>
          <input type="hidden" name="id" value={paper.id} />
          <SubmitButton variant="outline" size="sm" className="w-full bg-white/74">
            <Lightbulb className="size-3.5" />
            待验证
          </SubmitButton>
        </form>
        <form action={createReadingNoteFromPaper}>
          <input type="hidden" name="id" value={paper.id} />
          <SubmitButton variant="outline" size="sm" className="w-full bg-white/74">
            <FileText className="size-3.5" />
            笔记
          </SubmitButton>
        </form>
      </div>
    </div>
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
