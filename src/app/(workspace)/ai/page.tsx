import Link from "next/link";
import {
  BookOpenText,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileChartColumn,
  FileText,
  FlaskConical,
  KeyRound,
  PenLine,
  Settings,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import type { AdminItem, Note, Paper, Prisma } from "@prisma/client";

import { AiWorkbench } from "@/components/ai/ai-workbench";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { getAiSettings } from "@/lib/settings";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const presets = [
  {
    label: "组会提纲",
    action: "整理组会",
    detail: "任务、实验、文献、结果合成汇报骨架",
    prompt:
      "请只基于我下面粘贴的材料整理组会汇报提纲。不要补充我没有提供的事实、数据或引用；如果材料不足，请列出需要我补充的问题。\n\n【粘贴材料】\n- 本周任务：\n- 实验记录：\n- 关键结果：\n- 阅读文献：\n- 卡点/需要导师确认：\n\n【输出结构】\n1. 本周完成\n2. 关键证据\n3. 遇到的问题\n4. 需要导师确认\n5. 下周最小计划",
    icon: ClipboardList,
  },
  {
    label: "实验复盘",
    action: "复盘实验",
    detail: "把观察、失败原因和下一步收成清单",
    prompt:
      "请只基于我粘贴的实验材料生成复盘，不要编造参数、结果或原因。材料不足时先指出缺口。\n\n【粘贴材料】\n- 实验目的：\n- 设置/对照：\n- 观察现象：\n- 指标或结果：\n- 失败/异常：\n\n【输出结构】\n1. 实验目的\n2. 关键观察\n3. 可能原因与风险\n4. 下一步最小动作\n5. 需要补充记录的证据",
    icon: FlaskConical,
  },
  {
    label: "阅读卡片",
    action: "提炼论文",
    detail: "从论文摘录变成可回顾阅读卡片",
    prompt:
      "请只基于我粘贴的论文摘录整理阅读卡片。不要生成不存在的引用、页码或实验结论；不确定的地方标为待核对。\n\n【粘贴材料】\n- 题名/来源：\n- 摘录：\n- 我关心的问题：\n- 和当前课题的关系：\n\n【输出结构】\n1. 研究问题\n2. 方法与数据\n3. 关键结论\n4. 可借鉴点\n5. 与我课题的关系\n6. 待读/待核对问题",
    icon: BookOpenText,
  },
  {
    label: "写作润色",
    action: "打磨表达",
    detail: "优化结构和清晰度，事实由用户把关",
    prompt:
      "请把我粘贴的中文研究笔记改成更适合论文或组会汇报的表达。保持事实、数值和结论不变；不要新增引用或实验结果；不清楚的地方用【待确认】标出。\n\n【粘贴原文】\n\n\n【输出要求】\n1. 先给一版更清晰的改写\n2. 再列出我需要人工核对的事实、引用和结论\n3. 最后给 3 条后续写作建议",
    icon: PenLine,
  },
];

type RecentTask = Prisma.TaskGetPayload<{
  include: { milestone: { include: { project: true } } };
}>;

type RecentExperiment = Prisma.ExperimentGetPayload<{
  include: { project: true };
}>;

type RecentResult = Prisma.ResultGetPayload<{
  include: { experiment: true; dataset: true };
}>;

export default async function AiPage() {
  const settings = await getAiSettings();
  const [tasks, experiments, results, papers, notes, adminItems] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: "done" } },
      orderBy: [{ dueDate: "asc" }, { priority: "asc" }, { updatedAt: "desc" }],
      include: { milestone: { include: { project: true } } },
      take: 5,
    }),
    prisma.experiment.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: { project: true },
      take: 5,
    }),
    prisma.result.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: { experiment: true, dataset: true },
      take: 5,
    }),
    prisma.paper.findMany({
      where: { readStatus: { in: ["unread", "reading", "read"] } },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
    }),
    prisma.note.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
    }),
    prisma.adminItem.findMany({
      where: { status: { not: "done" } },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 5,
    }),
  ]);
  const recentPreset = {
    label: "最近材料包",
    action: "整理今天",
    detail: "用近期任务、实验、结果、文献和事务生成可核对草稿",
    prompt: buildRecentResearchPrompt({ tasks, experiments, results, papers, notes, adminItems }),
    icon: WandSparkles,
  };
  const scenePresets = [recentPreset, ...presets];
  const materialCount =
    tasks.length + experiments.length + results.length + papers.length + notes.length + adminItems.length;
  const draftFlow = [
    {
      icon: ClipboardList,
      title: "先用最近材料包",
      detail: `已整理 ${materialCount} 条近期材料，先删掉敏感内容和无关片段。`,
    },
    {
      icon: WandSparkles,
      title: "再生成一版草稿",
      detail: "只让 AI 做结构整理，不让它替你补事实、数据或引用。",
    },
    {
      icon: FileText,
      title: "最后保存到笔记",
      detail: "草稿通过人工核对后，沉淀到笔记工作室继续改写。",
    },
  ];

  return (
    <div className="grid gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="research-eyebrow">
                <Bot className="size-3.5" />
                科研助手
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                周报 · 复盘 · 阅读 · 写作
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              AI 页只做一件事：把研究材料变成可检查的草稿。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              不做万能聊天框，也不替你下结论。先围绕组会提纲、实验复盘、阅读卡片和写作润色，
              把你主动粘贴的脱敏材料整理成可人工核对的结构化草稿，再保存回笔记工作室继续编辑。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link className={buttonVariants({ variant: "default" })} href="/settings">
                <Settings className="size-4" />
                配置 AI
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/notes">
                <PenLine className="size-4" />
                打开笔记
              </Link>
            </div>
          </div>

          <div className="flex min-h-64 flex-col justify-between rounded-2xl action-stack p-4 text-white shadow-[0_18px_36px_rgba(22,34,53,0.16)]">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-white/68">
                <WandSparkles className="size-3.5" />
                今日助手栈
              </p>
              <div className="mt-4 grid gap-2.5">
                {scenePresets.slice(0, 3).map((preset, index) => (
                  <AiStackItem
                    key={preset.label}
                    index={`0${index + 1}`}
                    title={preset.action}
                    detail={preset.detail}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
              <div>
                <p className="text-lg font-semibold tracking-tight">{settings.apiKeyConfigured ? "已连" : "待连"}</p>
                <p className="mt-0.5 text-[11px] text-white/54">模型</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{materialCount}</p>
                <p className="mt-0.5 text-[11px] text-white/54">材料</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">人工</p>
                <p className="mt-0.5 text-[11px] text-white/54">把关</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="workbench-dual-grid grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
        <aside className="grid content-start gap-4">
          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                三步草稿流
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {draftFlow.map((step, index) => (
                <FlowStep
                  key={step.title}
                  icon={step.icon}
                  index={`0${index + 1}`}
                  title={step.title}
                  detail={step.detail}
                />
              ))}
              <div className="rounded-xl border border-[#d5e4e8] bg-[#f5fafb] p-3 text-xs leading-5 text-muted-foreground">
                场景按钮已经放到右侧工作台顶部，避免左侧和右侧重复选择。
              </div>
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" />
                最近材料包
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <MaterialRow icon={ClipboardList} label="任务" value={`${tasks.length} 条`} />
              <MaterialRow icon={FlaskConical} label="实验" value={`${experiments.length} 条`} />
              <MaterialRow icon={FileChartColumn} label="结果" value={`${results.length} 条`} />
              <MaterialRow icon={BookOpenText} label="文献" value={`${papers.length} 篇`} />
              <MaterialRow icon={FileText} label="笔记" value={`${notes.length} 篇`} />
              <MaterialRow icon={CalendarClock} label="事务" value={`${adminItems.length} 件`} />
              <p className="rounded-xl border border-[#d5e4e8] bg-[#f5fafb] p-3 text-xs leading-5 text-muted-foreground">
                材料包只会预填到输入框；点击“生成草稿”前，你仍可删掉敏感内容或改写上下文。
              </p>
            </CardContent>
          </Card>

          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                连接状态
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="soft-tile rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 font-medium">
                    {settings.apiKeyConfigured ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <KeyRound className="size-4 text-amber-600" />
                    )}
                    {settings.apiKeyConfigured ? "已配置 Key" : "待配置 Key"}
                  </span>
                  <Link className="text-xs text-primary underline-offset-4 hover:underline" href="/settings">
                    去设置
                  </Link>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Key 不会在浏览器显示明文；模型和 Base URL 可在设置中心随时改。
                </p>
              </div>
              <details className="rounded-xl border border-border/70 bg-white/74 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  查看当前模型
                </summary>
                <div className="mt-2 grid gap-2">
                  <InfoRow label="服务商" value={providerLabel(settings.provider)} />
                  <InfoRow label="模型" value={settings.model} />
                </div>
              </details>
            </CardContent>
          </Card>
        </aside>

        <Card className="workbench-card stretch-panel overflow-hidden">
          <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-primary" />
              助手工作台
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!settings.apiKeyConfigured ? (
              <div className="rounded-xl border border-amber-200 bg-[#fff8eb] p-3 text-sm leading-6 text-amber-950">
                还没有配置 AI Key。先去设置中心填 Key、Base URL 和模型名；未配置时这里只给连接指引，配置后会调用真实模型生成草稿。
              </div>
            ) : null}
            <AiWorkbench
              initialPrompt={recentPreset.prompt}
              presets={scenePresets.map(({ label, prompt, detail }) => ({ label, prompt, detail }))}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function AiStackItem({
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 soft-tile rounded-xl px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-all text-xs font-medium">{value}</span>
    </div>
  );
}

function MaterialRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white/76 px-3 py-2">
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <Icon className="size-3.5 text-primary" />
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

function FlowStep({
  icon: Icon,
  index,
  title,
  detail,
}: {
  icon: LucideIcon;
  index: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="soft-tile rounded-xl p-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#d5e4e8] bg-white/80 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">{index}</span>
            <p className="text-sm font-semibold text-[#173042]">{title}</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function providerLabel(value: string) {
  const labels: Record<string, string> = {
    openai: "OpenAI 兼容",
    anthropic: "Anthropic",
    custom: "自定义接口",
  };

  return labels[value] ?? value;
}

function buildRecentResearchPrompt({
  tasks,
  experiments,
  results,
  papers,
  notes,
  adminItems,
}: {
  tasks: RecentTask[];
  experiments: RecentExperiment[];
  results: RecentResult[];
  papers: Paper[];
  notes: Note[];
  adminItems: AdminItem[];
}) {
  const lines = [
    "请只基于下面这些来自研途 Hub 的近期材料，整理一份今天可执行的科研草稿。",
    "不要补充我没有提供的事实、数据、引用或实验结论；材料不足时请明确列出需要我补充的问题。",
    "",
    "【输出结构】",
    "1. 今天最值得推进的 3 件事",
    "2. 可用于组会/周报的关键证据",
    "3. 需要收口的实验、结果或文献",
    "4. 需要导师确认的问题",
    "5. 下一步最小行动清单",
    "",
    "【近期任务】",
    ...listOrEmpty(
      tasks.map((task) => {
        const owner = task.milestone
          ? `${task.milestone.project.title} / ${task.milestone.title}`
          : "独立任务";
        return `- ${task.title}（${owner}；${task.priority}；${task.status}；截止 ${formatDate(task.dueDate)}）`;
      }),
    ),
    "",
    "【近期实验】",
    ...listOrEmpty(
      experiments.map(
        (experiment) =>
          `- ${experiment.title}（${experiment.project?.title ?? "未关联课题"}；${experiment.status}；更新 ${formatDateTime(
            experiment.updatedAt,
          )}）${experiment.content ? `：${oneLine(experiment.content, 120)}` : ""}`,
      ),
    ),
    "",
    "【近期结果】",
    ...listOrEmpty(
      results.map(
        (result) =>
          `- ${result.title}（实验：${result.experiment?.title ?? "未关联"}；数据：${
            result.dataset?.name ?? "未关联"
          }；更新 ${formatDateTime(result.updatedAt)}）${result.notes ? `：${oneLine(result.notes, 120)}` : ""}`,
      ),
    ),
    "",
    "【近期文献】",
    ...listOrEmpty(
      papers.map(
        (paper) =>
          `- ${paper.title}（${paper.year ?? "年份未知"}；${paper.readStatus}；${paper.journal ?? "来源未知"}）${
            paper.notes ? `：${oneLine(paper.notes, 100)}` : ""
          }`,
      ),
    ),
    "",
    "【近期笔记】",
    ...listOrEmpty(
      notes.map(
        (note) =>
          `- ${note.title}（${note.folder}；更新 ${formatDateTime(note.updatedAt)}）：${oneLine(
            note.content,
            110,
          )}`,
      ),
    ),
    "",
    "【近期事务】",
    ...listOrEmpty(
      adminItems.map(
        (item) =>
          `- ${item.title}（${item.type}；${item.status}；截止 ${formatDate(item.dueDate)}）${
            item.notes ? `：${oneLine(item.notes, 90)}` : ""
          }`,
      ),
    ),
  ];

  return lines.join("\n");
}

function listOrEmpty(items: string[]) {
  return items.length ? items : ["- 暂无"];
}

function oneLine(value: string | null | undefined, maxLength: number) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized || "无正文";
  }

  return `${normalized.slice(0, maxLength)}...`;
}
