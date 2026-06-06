"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type AiResponse = {
  mode: "placeholder";
  configured: boolean;
  summary: string;
  suggestedActions: string[];
};

export function AiWorkbench() {
  const [prompt, setPrompt] = useState(
    "请根据最近的实验记录，帮我整理一份本周组会汇报提纲。",
  );
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
      <Textarea
        value={prompt}
        rows={8}
        onChange={(event) => setPrompt(event.target.value)}
        className="bg-white"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          当前接口只返回结构化占位结果，用来验证前端调用、鉴权和后续模型接入位置。
        </p>
        <Button type="button" onClick={submit} disabled={isPending || !prompt.trim()}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          试运行
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border bg-[#fffdf7] p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bot className="size-4 text-[#1f3d33]" />
            占位响应
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.summary}</p>
          <div className="mt-3 grid gap-2">
            {result.suggestedActions.map((action) => (
              <div key={action} className="rounded-md border bg-white px-3 py-2 text-sm">
                {action}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
