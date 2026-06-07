import Link from "next/link";
import {
  BookOpenText,
  Bot,
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
    prompt:
      "请把我最近一周的任务、实验、文献和结果整理成组会汇报提纲，结构包括：本周完成、关键证据、遇到的问题、下周计划。",
    icon: ClipboardList,
  },
  {
    label: "实验复盘",
    prompt:
      "请根据最近的实验记录生成一份复盘：实验目的、关键观察、失败原因或风险、下一步最小动作。",
    icon: FlaskConical,
  },
  {
    label: "阅读卡片",
    prompt:
      "请把最近阅读的论文整理成阅读卡片：研究问题、方法、关键结论、可借鉴点、和我当前课题的关系。",
    icon: BookOpenText,
  },
  {
    label: "写作润色",
    prompt:
      "请把我的中文研究笔记改成更适合论文或组会汇报的表达，保持事实不变，只提升结构和清晰度。",
    icon: PenLine,
  },
];

export default async function AiPage() {
  const settings = await getAiSettings();

  return (
    <div className="grid gap-5">
      <section className="dashboard-hero overflow-hidden rounded-2xl border border-border/70 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.08)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_0.88fr] xl:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/65 bg-white/72 px-2.5 py-1 text-xs font-medium text-[#315266]">
                <Bot className="size-3.5" />
                科研助手
              </span>
              <span className="rounded-full border border-white/55 bg-white/54 px-2.5 py-1 text-xs text-muted-foreground">
                周报 · 复盘 · 阅读 · 写作
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-[2rem] font-semibold leading-tight tracking-tight text-[#173042] md:text-[2.5rem]">
              AI 不做万能聊天框，先做能省时间的小工具。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#557083]">
              首版保留接口骨架和提示词工作台，优先围绕组会提纲、实验复盘、论文阅读卡片和写作润色。
              API Key、Base URL 和模型名仍在设置中心随时修改。
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

          <div className="grid gap-3 sm:grid-cols-2">
            <SignalCard
              icon={KeyRound}
              label="连接状态"
              value={settings.apiKeyConfigured ? "已配置" : "待配置"}
              detail={settings.model}
            />
            <SignalCard icon={WandSparkles} label="工作流" value="4 个入口" detail="从高频科研场景开始" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
        <aside className="grid content-start gap-4">
          <Card className="workbench-card">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                推荐入口
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {presets.map(({ label, prompt, icon: Icon }) => (
                <div key={label} className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-[#eef7f7] text-primary">
                      <Icon className="size-4" />
                    </span>
                    {label}
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
              <CardTitle>当前配置</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <InfoRow label="服务商" value={providerLabel(settings.provider)} />
              <InfoRow label="模型" value={settings.model} />
              <InfoRow label="Base URL" value={settings.baseUrl} />
              <p className="rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3 text-xs leading-5 text-muted-foreground">
                密钥只显示是否已配置，不会在浏览器中展示明文。
              </p>
            </CardContent>
          </Card>
        </aside>

        <Card className="workbench-card overflow-hidden">
          <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-primary" />
              助手试验台
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!settings.apiKeyConfigured ? (
              <div className="rounded-xl border border-amber-200 bg-[#fff8eb] p-3 text-sm leading-6 text-amber-950">
                还没有配置 AI Key。先去设置中心填 Key、Base URL 和模型名；当前试验台仍会返回结构化占位结果。
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

function SignalCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-white/72 bg-white/76 shadow-[0_12px_28px_rgba(27,42,56,0.06)] backdrop-blur">
      <CardContent className="flex items-start gap-3 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d7e7ea] bg-[#eef7f7] text-[#315266]">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-[#173042]">{value}</p>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-xl border border-border/72 bg-[#fbfcfd]/88 px-3 py-2">
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
