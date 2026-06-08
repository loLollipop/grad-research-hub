"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2, Send } from "lucide-react";

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
  presets?: Array<{ label: string; prompt: string }>;
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
    <div className="grid gap-3">
      {presets.length ? (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPrompt(preset.prompt)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      ) : null}
      <Textarea
        value={prompt}
        rows={8}
        onChange={(event) => setPrompt(event.target.value)}
        className="bg-white"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          只粘贴已脱敏材料；生成内容是草稿，事实、引用和结论要人工核对。
        </p>
        <Button type="button" onClick={submit} disabled={isPending || !prompt.trim()}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          生成草稿
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="soft-tile rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bot className="size-4 text-[#1f3d33]" />
            {result.mode === "live" ? "AI 草稿" : "配置提示"}
            <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-muted-foreground">
              {result.mode === "live" ? result.provider ?? "live" : "placeholder"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.summary}</p>
          <div className="mt-3 grid gap-2">
            {result.suggestedActions.map((action) => (
              <div key={action} className="rounded-md border bg-white px-3 py-2 text-sm">
                {action}
              </div>
            ))}
          </div>
          {result.mode === "live" ? (
            <form action={createNoteFromAiDraft} className="mt-3 flex justify-end">
              <input type="hidden" name="prompt" value={prompt} />
              <input type="hidden" name="draft" value={result.summary} />
              <input type="hidden" name="provider" value={result.provider ?? "AI"} />
              <input type="hidden" name="mode" value={result.mode} />
              <Button type="submit" variant="outline" size="sm">
                保存到笔记
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
