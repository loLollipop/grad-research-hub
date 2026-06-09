"use client";

import { useId, useState } from "react";
import { Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quickCapture } from "@/lib/actions";
import {
  inferQuickCaptureTarget,
  quickCaptureExamples,
  quickCaptureTargets,
} from "@/lib/quick-capture";

export function QuickCaptureBar() {
  const [content, setContent] = useState("");
  const examplesId = useId();
  const target = quickCaptureTargets[inferQuickCaptureTarget(content)];

  return (
    <form action={quickCapture} className="w-full max-w-3xl">
      <div className="command-bar flex items-center gap-1.5 rounded-2xl border border-border/60 bg-white/68 p-1 md:gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="content"
            list={examplesId}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="一句话捕捉：任务 / 实验 / 结果 / 文献 / 组会 / 想法"
            className="h-9 rounded-xl border-transparent bg-white/0 pl-8 text-sm shadow-none focus-visible:bg-white/88 md:h-10"
          />
          <datalist id={examplesId}>
            {quickCaptureExamples.map((example) => (
              <option key={example} value={example} />
            ))}
          </datalist>
        </div>
        <Button type="submit" className="h-9 shrink-0 rounded-xl px-3 md:h-10 md:px-4">
          <Sparkles className="size-4" />
          捕捉
        </Button>
      </div>
      <div className="mt-1.5 flex flex-col gap-1.5 px-1 lg:flex-row lg:items-center">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-white/58 px-2.5 py-1 text-[11px] text-muted-foreground">
          <span className="font-medium text-primary">将保存到：{target.label}</span>
          <span className="hidden sm:inline">· {target.detail}</span>
        </div>
        <div className="hidden min-w-0 flex-1 gap-1.5 overflow-x-auto lg:flex">
          {quickCaptureExamples.map((example) => (
            <button
              key={example}
              type="button"
              className="shrink-0 rounded-full border border-border/60 bg-white/58 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/25 hover:bg-white/86 hover:text-primary"
              title={`填入示例：${example}`}
              onClick={() => setContent(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
