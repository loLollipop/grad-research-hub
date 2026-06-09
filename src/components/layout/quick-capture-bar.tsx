"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const helpId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const target = quickCaptureTargets[inferQuickCaptureTarget(content)];

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.isComposing) return;

      const targetElement = event.target;
      const isTyping =
        targetElement instanceof HTMLInputElement ||
        targetElement instanceof HTMLTextAreaElement ||
        targetElement instanceof HTMLSelectElement ||
        (targetElement instanceof HTMLElement && targetElement.isContentEditable);
      const isCommandShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const isSlashShortcut = event.key === "/" && !isTyping;

      if (!isCommandShortcut && !isSlashShortcut) return;

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <form action={quickCapture} className="w-full max-w-3xl">
      <div className="command-bar flex items-center gap-1.5 rounded-2xl border border-border/60 bg-white/68 p-1 md:gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            name="content"
            list={examplesId}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && content) {
                event.preventDefault();
                setContent("");
              }
            }}
            aria-describedby={helpId}
            placeholder="一句话捕捉：任务 / 实验 / 结果 / 文献 / 组会 / 想法"
            className="h-9 rounded-xl border-transparent bg-white/0 pl-8 pr-24 text-sm shadow-none focus-visible:bg-white/88 md:h-10"
          />
          <div className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 text-[11px] text-muted-foreground sm:flex">
            <kbd className="rounded-md border border-border/70 bg-white/78 px-1.5 py-0.5 font-mono shadow-sm">
              Ctrl K
            </kbd>
            <span>/</span>
          </div>
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
        <div
          id={helpId}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-white/58 px-2.5 py-1 text-[11px] text-muted-foreground"
        >
          <span className="font-medium text-primary">将保存到：{target.label}</span>
          <span className="hidden sm:inline">· {target.detail}</span>
          <span className="hidden border-l border-border/70 pl-1.5 xl:inline">
            Ctrl/Cmd+K 聚焦，Esc 清空
          </span>
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
