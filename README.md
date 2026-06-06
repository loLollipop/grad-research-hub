# 研途 Hub / Grad Research Hub

面向理工科研究生的个人科研与日常事务管理平台。首版目标是自托管、易开源、能真实记录每天的碎片工作：项目任务、文献、实验、笔记、数据结果和轻行政事务。

## 功能范围

- Dashboard：汇总近期任务、文献、实验、笔记和行政待办。
- 文献管理：论文条目、作者、DOI/arXiv/Zotero/BibTeX 预留、阅读状态、标签和笔记。
- 实验记录：Markdown 实验日志、状态、项目/论文关联、Git/MLflow/DVC/Artifact 外部引用。
- 项目任务：项目、里程碑、任务看板、优先级和截止日期。
- 笔记知识库：Markdown 预览、标签、文件夹和基础 `[[双链]]` 文本识别。
- 数据结果：数据集登记、实验结果 JSON 指标、简单图表、对比列表和外部实验追踪引用。
- 轻行政：组会、材料、报销、截止事项的状态追踪。
- AI 骨架：服务端 `/api/ai` 占位接口和前端试验台，暂不调用真实模型。
- 设置与导出：环境状态、SQLite 信息、JSON 全量导出、BibTeX 文献导出。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui + lucide-react
- Prisma ORM + SQLite
- zod + Server Actions
- react-markdown + remark-gfm
- recharts

## 快速开始

```bash
npm install
cp .env.example .env
npm run db:init
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

`npm run db:init` 会用 `prisma/migrations/0001_init/migration.sql` 初始化 SQLite，并运行 `prisma/seed.mjs` 写入示例数据。

## 常用脚本

```bash
npm run dev       # 启动开发服务器
npm run build     # 生产构建
npm run lint      # ESLint 检查
npm run db:init   # 初始化 SQLite 并 seed
npm run db:reset  # 重建 SQLite 并 seed
npm run db:seed   # 仅写入种子数据
npm run db:studio # 打开 Prisma Studio
```

## 数据库

默认环境变量：

```env
DATABASE_URL="file:./dev.db"
```

SQLite 文件位于 `prisma/dev.db`。当前 Windows 中文/空格路径下，Prisma schema engine 可能导致 `prisma migrate dev` 空错误，所以 MVP 提供了 `scripts/init-db.mjs` 作为稳定初始化路径。迁移 SQL 仍保存在 `prisma/migrations/0001_init/migration.sql`，便于以后切换正式迁移流程。

## 导出

设置页提供 JSON 和 BibTeX 导出按钮，也可以直接访问：

```text
/api/export
/api/export/bibtex
```

JSON 导出包含所有 MVP 表和记录计数，适合备份、迁移前检查或导入脚本的起点。BibTeX 导出只包含文献条目，方便接入 Zotero、JabRef、LaTeX 或其他参考文献工具。

## 集成策略

研途 Hub 不计划替代成熟工具，而是做研究生日常工作的轻量中枢：

- Zotero：文献字段预留 `zoteroKey` 和 `bibtexKey`，优先做同步/导入导出，不重写参考文献管理器。
- MLflow / DVC：实验和结果字段预留 run id、实验名、Git commit 和 artifact path，不重写实验追踪系统。
- Logseq / Obsidian：当前保留 Markdown 和 `[[双链]]` 文本识别，后续可做 Markdown 导出或 vault 同步。
- OpenProject / Vikunja：项目任务保持轻量，高级甘特图、CalDAV、重复任务优先考虑集成或导出。

## AI 配置

`.env.example` 中预留：

```env
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
```

首版 `/api/ai` 只返回占位响应，不会调用外部模型。后续可以把最近任务、实验、文献和笔记作为上下文，扩展为周报提纲、实验复盘、论文阅读卡片或 RAG 问答。

## PostgreSQL / Supabase 迁移方向

1. 将 `prisma/schema.prisma` 的 datasource provider 从 `sqlite` 改为 `postgresql`。
2. 将 `DATABASE_URL` 指向 PostgreSQL 或 Supabase 连接串。
3. 当前标签字段使用 JSON 字符串兼容 SQLite，迁移后可继续保留，也可以拆为关系表。
4. PDF、图片和大文件不建议进入数据库；后续可接 Supabase Storage、S3 或本地对象存储。

## 开源说明

本仓库首版不包含登录、多用户、PDF 上传、Zotero 同步、DOI 自动抓取、RAG 问答、甘特图和知识图谱。这些更适合在 v1.1+ 迭代，避免 MVP 被集成复杂度拖慢。

开源协作相关文件：

- `LICENSE`：MIT License。
- `CONTRIBUTING.md`：本地开发、验证和贡献边界。
- `SECURITY.md`：当前 MVP 的安全边界。
- `ROADMAP.md`：后续版本路线。
- `.github/ISSUE_TEMPLATE/`：bug 和 feature issue 模板。
