export type QuickCaptureKind =
  | "task"
  | "experiment"
  | "paper"
  | "admin"
  | "result"
  | "dataset"
  | "note";

export type QuickCaptureTargetKey = "idle" | QuickCaptureKind;

export type QuickCaptureAlias =
  | { kind: "task" }
  | { kind: "experiment" }
  | { kind: "paper" }
  | { kind: "admin" }
  | { kind: "result" }
  | { kind: "dataset" }
  | { folder?: string; kind: "note"; tags?: string[] };

export type QuickCapturePrefix = {
  body: string;
  prefix: string;
};

export const quickCaptureExamples = [
  "周五组会准备图表",
  "先补一组对照实验",
  "样本 B 的裂纹扩展更明显",
  "消融实验准确率提升 2%",
  "补读最新综述",
  "今天失败可能是参数窗口太窄",
] as const;

export const quickCaptureTypeChips = [
  { hint: "下一步 / 导师反馈", label: "任务", prefix: "任务" },
  { hint: "观察 / 失败 / 复现", label: "实验", prefix: "实验" },
  { hint: "指标 / 图表 / 结论", label: "成果", prefix: "结果" },
  { hint: "待读 / 综述 / DOI", label: "文献", prefix: "文献" },
  { hint: "组会 / 材料 / 截止", label: "事务", prefix: "组会" },
  { hint: "想法 / 写作素材", label: "笔记", prefix: "想法" },
] as const;

export const quickCaptureTargets: Record<
  QuickCaptureTargetKey,
  { detail: string; label: string }
> = {
  idle: {
    label: "直接写一句话",
    detail: "按关键词自动归档，也可点类型",
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
    detail: "先放收件箱，之后再整理",
  },
};

const quickCaptureAliasEntries: Array<[string, QuickCaptureAlias]> = [
  ["任务", { kind: "task" }],
  ["待办", { kind: "task" }],
  ["下一步", { kind: "task" }],
  ["行动", { kind: "task" }],
  ["导师", { kind: "task" }],
  ["反馈", { kind: "task" }],
  ["卡点", { kind: "task" }],
  ["问题", { kind: "task" }],
  ["待确认", { kind: "task" }],
  ["todo", { kind: "task" }],
  ["task", { kind: "task" }],
  ["t", { kind: "task" }],
  ["实验", { kind: "experiment" }],
  ["试验", { kind: "experiment" }],
  ["观察", { kind: "experiment" }],
  ["现象", { kind: "experiment" }],
  ["复盘", { kind: "experiment" }],
  ["失败", { kind: "experiment" }],
  ["experiment", { kind: "experiment" }],
  ["exp", { kind: "experiment" }],
  ["e", { kind: "experiment" }],
  ["文献", { kind: "paper" }],
  ["论文", { kind: "paper" }],
  ["阅读", { kind: "paper" }],
  ["article", { kind: "paper" }],
  ["paper", { kind: "paper" }],
  ["p", { kind: "paper" }],
  ["事务", { kind: "admin" }],
  ["提醒", { kind: "admin" }],
  ["组会", { kind: "admin" }],
  ["会议", { kind: "admin" }],
  ["截止", { kind: "admin" }],
  ["材料", { kind: "admin" }],
  ["报销", { kind: "admin" }],
  ["meeting", { kind: "admin" }],
  ["deadline", { kind: "admin" }],
  ["admin", { kind: "admin" }],
  ["结果", { kind: "result" }],
  ["成果", { kind: "result" }],
  ["证据", { kind: "result" }],
  ["result", { kind: "result" }],
  ["evidence", { kind: "result" }],
  ["数据", { kind: "dataset" }],
  ["数据集", { kind: "dataset" }],
  ["dataset", { kind: "dataset" }],
  ["data", { kind: "dataset" }],
  ["笔记", { kind: "note", folder: "Inbox" }],
  ["想法", { kind: "note", folder: "Inbox", tags: ["想法"] }],
  ["灵感", { kind: "note", folder: "Inbox", tags: ["想法"] }],
  ["idea", { kind: "note", folder: "Inbox", tags: ["想法"] }],
  ["note", { kind: "note", folder: "Inbox" }],
  ["写作", { kind: "note", folder: "写作", tags: ["写作素材"] }],
  ["周报", { kind: "note", folder: "写作", tags: ["周报"] }],
  ["初稿", { kind: "note", folder: "写作", tags: ["论文初稿"] }],
  ["draft", { kind: "note", folder: "写作", tags: ["论文初稿"] }],
];

const quickCaptureAliasMap = new Map(
  quickCaptureAliasEntries.map(([prefix, alias]) => [normalizeQuickPrefix(prefix), alias]),
);

const quickCaptureAutoRules: Array<{ alias: QuickCaptureAlias; pattern: RegExp }> = [
  {
    alias: { kind: "admin" },
    pattern: /组会|会议|汇报|报销|发票|经费|材料|表格|证明|申请|截止|ddl|deadline|meeting|seminar/i,
  },
  {
    alias: { kind: "paper" },
    pattern: /文献|论文|综述|阅读|引用|doi|arxiv|zotero|related\s*work|paper|article|review/i,
  },
  {
    alias: { kind: "result" },
    pattern: /结果|成果|证据|图表|曲线|表格|指标|准确率|精度|召回|auc|rmse|mae|提升|下降|显著|消融/i,
  },
  {
    alias: { kind: "task" },
    pattern: /待办|下一步|需要|整理|跟进|确认|检查|明天|本周|todo|task/i,
  },
  {
    alias: { kind: "dataset" },
    pattern: /数据集|数据来源|样本库|dataset|data\s*source/i,
  },
  {
    alias: { kind: "experiment" },
    pattern: /实验|试验|观察|现象|复现|对照|样本|参数|失败|不稳定|baseline|ablation/i,
  },
  {
    alias: { kind: "note", folder: "Inbox", tags: ["想法"] },
    pattern: /想法|灵感|假设|思路|脑洞|idea|note/i,
  },
];

export function extractQuickPrefix(content: string): QuickCapturePrefix | null {
  const colonMatch = content.match(/^([^:：]{1,16})[:：]\s*(.+)$/);
  if (colonMatch?.[1] && colonMatch[2]?.trim()) {
    return {
      body: colonMatch[2].trim(),
      prefix: colonMatch[1].trim(),
    };
  }

  const tokenMatch = content.match(/^([/#]?[A-Za-z][\w-]{0,15}|[/#]?[\p{Script=Han}]{1,8})\s+(.+)$/u);
  if (tokenMatch?.[1] && tokenMatch[2]?.trim()) {
    return {
      body: tokenMatch[2].trim(),
      prefix: tokenMatch[1].trim(),
    };
  }

  return null;
}

export function quickCaptureAlias(prefix: string): QuickCaptureAlias | null {
  return quickCaptureAliasMap.get(normalizeQuickPrefix(prefix)) ?? null;
}

export function inferQuickCaptureAlias(content: string): QuickCaptureAlias | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const prefixed = extractQuickPrefix(trimmed);
  if (prefixed) {
    const alias = quickCaptureAlias(prefixed.prefix);
    if (alias) return alias;
  }

  return quickCaptureAutoRules.find((rule) => rule.pattern.test(trimmed))?.alias ?? null;
}

export function inferQuickCaptureTarget(content: string): QuickCaptureTargetKey {
  if (!content.trim()) return "idle";

  return inferQuickCaptureAlias(content)?.kind ?? "note";
}

function normalizeQuickPrefix(prefix: string) {
  return prefix.trim().replace(/^[/#]/, "").toLowerCase();
}
