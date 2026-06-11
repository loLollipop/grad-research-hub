"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  BookOpenText,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Lightbulb,
  LineChart,
  NotebookPen,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quickCapture } from "@/lib/actions";
import {
  inferQuickCaptureTarget,
  quickCaptureExamples,
  quickCaptureTargets,
  quickCaptureTypeChips,
} from "@/lib/quick-capture";

const typeIcons = {
  任务: CheckCircle2,
  实验: FlaskConical,
  成果: LineChart,
  文献: BookOpenText,
  事务: ClipboardList,
  笔记: NotebookPen,
} as const;

const existingPrefixPattern =
  /^(任务|待办|下一步|行动|导师|反馈|卡点|问题|实验|试验|观察|现象|复盘|失败|文献|论文|阅读|事务|提醒|组会|会议|截止|材料|报销|结果|成果|证据|数据|数据集|笔记|想法|灵感|写作|周报|初稿)[:：\s]+/i;

export function QuickCaptureBar() {
  const [content, setContent] = useState("");
  const examplesId = useId();
  const helpId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const target = quickCaptureTargets[inferQuickCaptureTarget(content)];
  const hasContent = content.trim().length > 0;

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
    <form ref={formRef} action={quickCapture} className="w-full max-w-3xl">
      <div className="command-bar flex items-center gap-1.5 rounded-2xl border border-border/60 bg-white/68 p-1 md:gap-2">
        <div className="relative flex-1">
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

              if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && hasContent) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            aria-describedby={helpId}
            placeholder="快速捕捉：组会图表、补对照实验……"
            className="h-10 rounded-xl border-transparent bg-white/0 pl-4 pr-24 text-sm shadow-none placeholder:text-muted-foreground/72 focus-visible:bg-white/88 md:h-11"
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
        <CaptureSubmitButton disabled={!hasContent} />
      </div>
      <div className="mt-1.5 flex flex-col gap-1.5 px-1 lg:flex-row lg:items-center">
        <div
          id={helpId}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-white/62 px-2.5 py-1 text-[11px] text-muted-foreground"
        >
          <Lightbulb className="size-3 text-primary" />
          <span className="font-medium text-primary">收进：{target.label}</span>
          <span className="hidden sm:inline">· Ctrl/Cmd+Enter 提交</span>
        </div>
        <div className="hidden min-w-0 flex-1 gap-1.5 overflow-x-auto xl:flex">
          {quickCaptureTypeChips.map((chip) => {
            const Icon = typeIcons[chip.label];
            const chipActive = hasContent && target.label === chip.label;

            return (
              <button
                key={chip.label}
                type="button"
                className={[
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition",
                  chipActive
                    ? "border-primary/25 bg-primary text-primary-foreground shadow-sm"
                    : "border-border/60 bg-white/58 text-muted-foreground hover:border-primary/25 hover:bg-white/86 hover:text-primary",
                ].join(" ")}
                title={`${chip.label}：${chip.hint}`}
                onClick={() => {
                  const body = content.trim();
                  setContent(body ? `${chip.prefix} ${body.replace(existingPrefixPattern, "")}` : `${chip.prefix} `);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              >
                <Icon className="mr-1 inline size-3" />
                {chip.label}
              </button>
            );
          })}
          {quickCaptureExamples.slice(0, 3).map((example) => (
            <button
              key={example}
              type="button"
              className="shrink-0 rounded-full border border-dashed border-border/70 bg-white/42 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/25 hover:bg-white/86 hover:text-primary"
              title={`示例：${example}`}
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

function CaptureSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="h-10 shrink-0 rounded-xl px-3 md:h-11 md:px-4"
      disabled={pending || disabled}
    >
      <Sparkles className="size-4" />
      {pending ? "保存中" : "捕捉"}
    </Button>
  );
}
