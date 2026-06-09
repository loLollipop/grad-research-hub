"use client";

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quickCapture } from "@/lib/actions";

const captureExamples = [
  "任务 整理今天的实验观察",
  "实验 复现论文里的关键对照",
  "结果 消融实验准确率提升 2%",
  "文献 补读最新综述",
  "组会 周五汇报准备图表",
  "想法 把失败样本单独分析",
] as const;

export function QuickCaptureBar() {
  const [content, setContent] = useState("");

  return (
    <form action={quickCapture} className="w-full max-w-3xl">
      <div className="command-bar flex items-center gap-1.5 rounded-2xl border border-border/60 bg-white/68 p-1 md:gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="content"
            list="quick-capture-examples"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="一句话捕捉：任务 / 实验 / 结果 / 文献 / 组会 / 想法"
            className="h-9 rounded-xl border-transparent bg-white/0 pl-8 text-sm shadow-none focus-visible:bg-white/88 md:h-10"
          />
          <datalist id="quick-capture-examples">
            {captureExamples.map((example) => (
              <option key={example} value={example} />
            ))}
          </datalist>
        </div>
        <Button type="submit" className="h-9 shrink-0 rounded-xl px-3 md:h-10 md:px-4">
          <Sparkles className="size-4" />
          捕捉
        </Button>
      </div>
      <div className="mt-1.5 hidden gap-1.5 overflow-x-auto px-1 lg:flex">
        {captureExamples.slice(0, 5).map((example) => (
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
    </form>
  );
}
