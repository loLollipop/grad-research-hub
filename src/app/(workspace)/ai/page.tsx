import Link from "next/link";
import {
  BookOpenText,
  Bot,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  KeyRound,
  PenLine,
  Settings,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { AiWorkbench } from "@/components/ai/ai-workbench";
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
      "请把我最近一周的任务、实验、文献和结果整理成组会汇报提纲，结构包括：本周完成、关键证据、遇到的问题、下周计划。",
    icon: ClipboardList,
  },
  {
    label: "实验复盘",
    action: "复盘实验",
    detail: "把观察、失败原因和下一步收成清单",
    prompt:
      "请根据最近的实验记录生成一份复盘：实验目的、关键观察、失败原因或风险、下一步最小动作。",
    icon: FlaskConical,
  },
  {
    label: "阅读卡片",
    action: "提炼论文",
    detail: "从论文摘录变成可回顾阅读卡片",
    prompt:
      "请把最近阅读的论文整理成阅读卡片：研究问题、方法、关键结论、可借鉴点、和我当前课题的关系。",
    icon: BookOpenText,
  },
  {
    label: "写作润色",
    action: "打磨表达",
    detail: "优化结构和清晰度，事实由用户把关",
    prompt:
      "请把我的中文研究笔记改成更适合论文或组会汇报的表达，保持事实不变，只提升结构和清晰度。",
    icon: PenLine,
  },
];

export default async function AiPage() {
  const settings = await getAiSettings();

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
              把已有笔记整理成可人工核对的结构化草稿，再保存回笔记工作室继续编辑。
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
                {presets.slice(0, 3).map((preset, index) => (
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
                <p className="text-lg font-semibold tracking-tight">{presets.length}</p>
                <p className="mt-0.5 text-[11px] text-white/54">入口</p>
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
                场景入口
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {presets.map(({ label, prompt, action, icon: Icon }) => (
                <div key={label} className="soft-tile rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#eef7f7] text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{action}</p>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {prompt}
                  </p>
                </div>
              ))}
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
              <InfoRow label="服务商" value={providerLabel(settings.provider)} />
              <InfoRow label="模型" value={settings.model} />
              <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
                建议先粘贴经过脱敏的笔记片段。AI 输出只当草稿，事实、引用和结论必须人工核对。
              </p>
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
              initialPrompt={presets[0].prompt}
              presets={presets.map(({ label, prompt }) => ({ label, prompt }))}
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

function providerLabel(value: string) {
  const labels: Record<string, string> = {
    openai: "OpenAI 兼容",
    anthropic: "Anthropic",
    custom: "自定义接口",
  };

  return labels[value] ?? value;
}
