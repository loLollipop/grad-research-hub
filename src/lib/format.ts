export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function splitTags(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function tagsToString(tags: string[]): string {
  return JSON.stringify([...new Set(tags)]);
}

export function parseTags(value: string | null | undefined): string[] {
  return parseJson<string[]>(value, []);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "未设置";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "未设置";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function daysUntil(value: Date | null | undefined) {
  if (!value) {
    return null;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - start.getTime()) / 86_400_000);
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "进行中",
    archived: "归档",
    paused: "暂停",
    planned: "计划中",
    running: "进行中",
    completed: "已完成",
    failed: "失败",
    abandoned: "放弃",
    todo: "待办",
    doing: "进行中",
    done: "完成",
    unread: "未读",
    reading: "读中",
    read: "已读",
    meeting: "会议",
    material: "材料",
    reimbursement: "报销",
    deadline: "截止",
  };

  return labels[status] ?? status;
}

export function priorityLabel(priority: string) {
  const labels: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };

  return labels[priority] ?? priority;
}

export function extractWikiLinks(content: string) {
  return Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g))
    .map((match) => match[1]?.trim())
    .filter(Boolean);
}

export function metricsFromJson(value: string) {
  const parsed = parseJson<Record<string, number | string>>(value, {});
  return Object.entries(parsed).map(([name, metric]) => ({
    name,
    value: typeof metric === "number" ? metric : Number(metric) || 0,
  }));
}
