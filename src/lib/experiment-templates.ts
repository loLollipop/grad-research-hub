export const EXPERIMENT_TEMPLATES = [
  {
    value: "purpose-method-result",
    label: "目的 / 方法 / 结果",
    detail: "最通用，适合日常实验记录。",
    content: "## 目的\n\n## 方法 / 参数\n\n## 观察\n\n## 结论 / 下一步\n",
  },
  {
    value: "ablation",
    label: "消融实验",
    detail: "比较变量，记录控制条件。",
    content: "## 目的\n\n## 控制变量\n\n## 对比设置\n\n## 观察\n\n## 结论 / 下一步\n",
  },
  {
    value: "reproduction",
    label: "复现实验",
    detail: "验证论文或旧结果是否可靠。",
    content: "## 复现目标\n\n## 环境 / 数据\n\n## 复现步骤\n\n## 差异记录\n\n## 结论 / 下一步\n",
  },
  {
    value: "debug",
    label: "问题排查",
    detail: "记录失败路径和排错结论。",
    content: "## 问题现象\n\n## 排查假设\n\n## 已尝试方法\n\n## 当前结论\n\n## 下一步\n",
  },
] as const;

export function experimentTemplateLabel(template: string) {
  return EXPERIMENT_TEMPLATES.find((item) => item.value === template)?.label ?? template;
}

export function experimentTemplateContent(template: string | undefined) {
  return (
    EXPERIMENT_TEMPLATES.find((item) => item.value === template)?.content ??
    EXPERIMENT_TEMPLATES[0].content
  );
}
