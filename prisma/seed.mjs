import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tags = (items) => JSON.stringify(items);
const json = (value) => JSON.stringify(value);

async function main() {
  await prisma.result.deleteMany();
  await prisma.dataset.deleteMany();
  await prisma.experiment.deleteMany();
  await prisma.paper.deleteMany();
  await prisma.task.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.project.deleteMany();
  await prisma.note.deleteMany();
  await prisma.adminItem.deleteMany();

  const project = await prisma.project.create({
    data: {
      title: "多模态材料缺陷检测",
      description: "围绕图像、光谱和实验记录建立一套可复现实验流程。",
      status: "active",
      tags: tags(["课题", "计算科研"]),
      milestones: {
        create: [
          {
            title: "完成基线模型复现实验",
            status: "running",
            dueDate: new Date("2026-06-18"),
            tasks: {
              create: [
                {
                  title: "整理训练数据版本与划分",
                  priority: "high",
                  status: "doing",
                  dueDate: new Date("2026-06-09"),
                  tags: tags(["数据集", "复现"]),
                },
                {
                  title: "输出第一版导师周报",
                  priority: "medium",
                  status: "todo",
                  dueDate: new Date("2026-06-12"),
                  tags: tags(["周报"]),
                },
              ],
            },
          },
          {
            title: "准备组会阶段汇报",
            status: "planned",
            dueDate: new Date("2026-06-30"),
          },
        ],
      },
    },
    include: { milestones: true },
  });

  const paper = await prisma.paper.create({
    data: {
      title: "A Survey of Vision Foundation Models for Scientific Discovery",
      authors: tags(["Chen Li", "Rui Wang", "Ming Zhao"]),
      year: 2025,
      journal: "arXiv preprint",
      arxivId: "2501.01234",
      zoteroKey: "SEED2026A",
      bibtexKey: "li2025visionfoundation",
      category: "精读",
      readStatus: "reading",
      externalUrl: "https://arxiv.org/abs/2501.01234",
      tags: tags(["foundation-model", "survey", "vision"]),
      abstract:
        "A seed paper for planning multimodal scientific discovery workflows.",
      notes:
        "重点看方法分类表、数据集组织方式，以及可迁移到材料缺陷检测的评估指标。",
    },
  });

  const experiment = await prisma.experiment.create({
    data: {
      title: "ResNet50 基线复现实验 v0",
      projectId: project.id,
      status: "running",
      template: "purpose-method-result",
      tags: tags(["baseline", "training"]),
      content:
        "## 目的\n复现基线模型，确认数据划分和指标口径。\n\n## 参数\n- backbone: ResNet50\n- batch size: 32\n- seed: 42\n\n## 今日观察\n验证集波动较大，需要检查类别不平衡。",
      papers: { connect: [{ id: paper.id }] },
    },
  });

  const dataset = await prisma.dataset.create({
    data: {
      name: "DefectSet-A",
      source: "实验室历史数据",
      version: "2026-06-clean",
      path: "D:/research/data/defectset-a",
      externalUrl: "https://example.org/datasets/defectset-a",
      description: "清洗后的材料缺陷图像数据集，包含四类缺陷标签。",
      tags: tags(["image", "defect", "internal"]),
    },
  });

  await prisma.result.create({
    data: {
      title: "baseline-resnet50-seed42",
      experimentId: experiment.id,
      datasetId: dataset.id,
      metrics: json({ accuracy: 0.842, f1: 0.801, loss: 0.438 }),
      config: json({ model: "resnet50", batchSize: 32, seed: 42 }),
      notes: "首轮结果可作为后续增强模型的对照。",
    },
  });

  await prisma.note.createMany({
    data: [
      {
        title: "组会记录 2026-06-06",
        folder: "组会",
        tags: tags(["组会", "导师反馈"]),
        content:
          "导师建议先把 [[多模态材料缺陷检测]] 的数据版本固定，再做模型对比。下周汇报需要给出误差案例。",
      },
      {
        title: "灵感收件箱",
        folder: "收件箱",
        tags: tags(["收件箱"]),
        content:
          "尝试把实验记录中的失败案例自动汇总成周报片段，减少周五晚上临时拼材料。",
      },
    ],
  });

  await prisma.adminItem.createMany({
    data: [
      {
        title: "提交会议室预约截图",
        type: "material",
        status: "todo",
        dueDate: new Date("2026-06-10"),
        tags: tags(["组会", "材料"]),
      },
      {
        title: "周三组会",
        type: "meeting",
        status: "todo",
        dueDate: new Date("2026-06-11T09:00:00+08:00"),
        location: "学院楼 B402",
        notes: "带上基线实验曲线和失败样例。",
        tags: tags(["组会"]),
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
