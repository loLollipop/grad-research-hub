"use client";

import { useState, useTransition } from "react";
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createNoteFromAiDraft } from "@/lib/actions";

type AiResponse = {
  mode: "live" | "placeholder";
  configured: boolean;
  provider?: string;
  summary: string;
  suggestedActions: string[];
};

export function AiWorkbench({
  initialPrompt = "请根据最近的实验记录，帮我整理一份本周组会汇报提纲。",
  presets = [],
}: {
  initialPrompt?: string;
  presets?: Array<{ label: string; prompt: string; detail?: string }>;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [result, setResult] = useState<AiResponse | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });

        const payload = (await response.json()) as AiResponse | { error?: string };
        if (!response.ok) {
          setResult(null);
          setError("error" in payload && payload.error ? payload.error : "AI 请求失败");
          return;
        }

        setResult(payload as AiResponse);
      } catch (requestError) {
        setResult(null);
        setError(requestError instanceof Error ? requestError.message : "AI 请求失败");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {presets.length ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto min-h-20 items-start justify-start whitespace-normal rounded-xl bg-white/78 px-3 py-3 text-left"
              onClick={() => setPrompt(preset.prompt)}
            >
              <ClipboardCheck className="mt-0.5 size-3.5" />
              <span className="grid min-w-0 gap-1">
                <span className="line-clamp-1 font-medium">{preset.label}</span>
                {preset.detail ? (
                  <span className="line-clamp-2 text-xs font-normal leading-5 text-muted-foreground">
                    {preset.detail}
                  </span>
                ) : null}
              </span>
            </Button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(22rem,0.96fr)]">
        <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-border/72 bg-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="flex items-start justify-between gap-3 border-b border-border/70 bg-[linear-gradient(135deg,rgba(240,247,247,0.92),rgba(255,250,238,0.74))] px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#173042]">
                <Bot className="size-4 text-primary" />
                草稿输入
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                先选场景，再粘贴脱敏材料；没有提供的事实会被要求标为待补。
              </p>
            </div>
            <span className="rounded-full border border-white/80 bg-white/72 px-2 py-0.5 text-[11px] text-muted-foreground">
              {prompt.trim().length} 字
            </span>
          </div>

          <div className="border-b border-border/70 bg-[#f8fbf8]/86 px-4 py-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d5e4e8] bg-white/78 px-2 py-1 text-[#315266]">
                <ShieldCheck className="size-3" />
                已脱敏
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d5e4e8] bg-white/78 px-2 py-1 text-[#315266]">
                <Sparkles className="size-3" />
                只基于粘贴材料
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ead9ad] bg-[#fff8e7] px-2 py-1 text-[#765a23]">
                <ClipboardCheck className="size-3" />
                输出后人工核对
              </span>
            </div>
          </div>

          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="min-h-[22rem] flex-1 resize-none rounded-none border-0 bg-white/68 p-4 text-sm leading-6 shadow-none focus-visible:ring-0"
          />

          <div className="flex flex-col gap-3 border-t border-border/70 bg-white/72 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
              生成内容只当草稿；事实、引用、结论和涉密信息都要人工核对。
            </p>
            <Button type="button" onClick={submit} disabled={isPending || !prompt.trim()}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              生成草稿
            </Button>
          </div>
        </section>

        <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-border/72 bg-[#fbfcf8]/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
          <div className="flex items-start justify-between gap-3 border-b border-border/70 bg-white/64 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#173042]">
                <FilePlus2 className="size-4 text-primary" />
                可核对草稿
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                生成后可直接保存到笔记工作室继续改。
              </p>
            </div>
            {result ? (
              <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-muted-foreground">
                {result.mode === "live" ? result.provider ?? "live" : "配置提示"}
              </span>
            ) : null}
          </div>

          {result ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <div className="rounded-xl border border-[#d5e4e8] bg-white/86 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="size-4 text-[#1f3d33]" />
                  {result.mode === "live" ? "AI 草稿" : "配置提示"}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {result.summary}
                </p>
              </div>

              <div className="grid gap-2">
                {result.suggestedActions.map((action, index) => (
                  <div
                    key={`${action}-${index}`}
                    className="flex items-start gap-2 rounded-xl border border-border/70 bg-white/74 px-3 py-2 text-sm leading-6"
                  >
                    <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-primary" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>

              {result.mode === "live" ? (
                <form action={createNoteFromAiDraft} className="mt-auto flex justify-end border-t border-border/65 pt-3">
                  <input type="hidden" name="prompt" value={prompt} />
                  <input type="hidden" name="draft" value={result.summary} />
                  <input type="hidden" name="provider" value={result.provider ?? "AI"} />
                  <input type="hidden" name="mode" value={result.mode} />
                  <Button type="submit" variant="outline" size="sm">
                    <FilePlus2 className="size-3.5" />
                    保存到笔记
                  </Button>
                </form>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-sm text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-[#d5e4e8] bg-white/82 text-primary">
                  <Bot className="size-5" />
                </span>
                <p className="mt-3 text-sm font-medium text-[#173042]">先准备一段材料</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  选择场景、补充上下文，然后生成一版可核对草稿。这里不会自动读取你的全部数据。
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
