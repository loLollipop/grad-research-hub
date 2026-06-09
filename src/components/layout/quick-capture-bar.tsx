"use client";

import { useId, useState } from "react";
import { Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quickCapture } from "@/lib/actions";

const captureExamples = [
  "导师 反馈：先补对照实验",
  "卡点 模型在第三批数据上不稳定",
  "观察 样本 B 的裂纹扩展更明显",
  "结果 消融实验准确率提升 2%",
  "文献 补读最新综述",
  "组会 周五汇报准备图表",
  "复盘 今天失败可能是参数窗口太窄",
] as const;

const captureTargets = {
  idle: {
    label: "等待输入",
    detail: "写一句话后显示去向",
  },
  task: {
    label: "任务",
    detail: "进入课题页待办队列",
  },
  experiment: {
    label: "实验",
    detail: "生成实验记录草稿",
  },
  result: {
    label: "成果",
    detail: "进入结果证据台",
  },
  paper: {
    label: "文献",
    detail: "进入待读文献",
  },
  admin: {
    label: "事务",
    detail: "进入组会/材料提醒",
  },
  dataset: {
    label: "数据",
    detail: "登记数据来源",
  },
  note: {
    label: "笔记",
    detail: "进入收件箱",
  },
} as const;

type CaptureTargetKey = keyof typeof captureTargets;

const captureAlias: Record<string, CaptureTargetKey> = {
  任务: "task",
  待办: "task",
  下一步: "task",
  行动: "task",
  导师: "task",
  反馈: "task",
  卡点: "task",
  问题: "task",
  待确认: "task",
  todo: "task",
  task: "task",
  t: "task",
  实验: "experiment",
  试验: "experiment",
  观察: "experiment",
  现象: "experiment",
  复盘: "experiment",
  失败: "experiment",
  experiment: "experiment",
  exp: "experiment",
  e: "experiment",
  文献: "paper",
  论文: "paper",
  阅读: "paper",
  article: "paper",
  paper: "paper",
  p: "paper",
  事务: "admin",
  提醒: "admin",
  组会: "admin",
  会议: "admin",
  截止: "admin",
  材料: "admin",
  报销: "admin",
  meeting: "admin",
  deadline: "admin",
  admin: "admin",
  结果: "result",
  成果: "result",
  证据: "result",
  result: "result",
  evidence: "result",
  数据: "dataset",
  数据集: "dataset",
  dataset: "dataset",
  data: "dataset",
  笔记: "note",
  想法: "note",
  灵感: "note",
  idea: "note",
  note: "note",
  写作: "note",
  周报: "note",
  初稿: "note",
  draft: "note",
};

export function QuickCaptureBar() {
  const [content, setContent] = useState("");
  const examplesId = useId();
  const target = captureTargets[inferCaptureTarget(content)];

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
      <div className="mt-1.5 flex flex-col gap-1.5 px-1 lg:flex-row lg:items-center">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-white/58 px-2.5 py-1 text-[11px] text-muted-foreground">
          <span className="font-medium text-primary">将保存到：{target.label}</span>
          <span className="hidden sm:inline">· {target.detail}</span>
        </div>
        <div className="hidden min-w-0 flex-1 gap-1.5 overflow-x-auto lg:flex">
          {captureExamples.map((example) => (
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

function inferCaptureTarget(content: string): CaptureTargetKey {
  if (!content.trim()) return "idle";

  const prefix = extractPrefix(content);
  if (!prefix) return "note";

  return captureAlias[prefix.trim().replace(/^[/#]/, "").toLowerCase()] ?? "note";
}

function extractPrefix(content: string) {
  const trimmed = content.trim();
  const colonMatch = trimmed.match(/^([^:：]{1,16})[:：]\s*(.+)$/);
  if (colonMatch?.[1] && colonMatch[2]?.trim()) {
    return colonMatch[1];
  }

  const tokenMatch = trimmed.match(/^([/#]?[A-Za-z][\w-]{0,15}|[/#]?[\p{Script=Han}]{1,8})\s+(.+)$/u);
  if (tokenMatch?.[1] && tokenMatch[2]?.trim()) {
    return tokenMatch[1];
  }

  return null;
}
