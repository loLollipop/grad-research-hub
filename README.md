# 研途 Hub / Grad Research Hub

面向理工科研究生的个人科研与日常事务管理平台。产品定位是一个轻量工作台：把任务、文献阅读、实验记录、笔记、数据结果和组会材料收拢起来，但不替代 Zotero、数据库、实验追踪或云部署平台。

## 功能范围

- 首页：汇总近期任务、文献、实验、笔记和行政待办。
- 文献：通过 Zotero Web API 同步文献元数据，平台内只维护阅读状态、标签、筛选和笔记。
- 实验：Markdown 实验记录，保留目的、方法、结果、结论和项目/论文关联。
- 项目：看板式任务推进，项目、里程碑和任务通过折叠入口维护。
- 笔记：Markdown 预览、标签、分类和基础 `[[双链]]` 文本识别。
- 数据：数据集登记、实验指标 JSON、简单图表和结果对比。
- 事务：组会、材料、报销、截止事项的状态追踪。
- AI：服务端接口和试验台骨架，密钥只通过环境变量读取。
- 设置：Vercel 环境变量状态、Zotero/AI 配置状态、JSON/BibTeX 导出。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui + lucide-react
- Prisma ORM + PostgreSQL
- zod + Server Actions
- react-markdown + remark-gfm
- recharts

## Vercel 部署

1. Fork 或导入本仓库到 GitHub。
2. 在 Vercel 中导入项目。
3. 绑定 PostgreSQL 数据库，例如 Vercel Postgres、Neon 或 Supabase，并设置 `DATABASE_URL`。
4. 在 Vercel Environment Variables 中设置需要的 Zotero 和 AI 变量。
5. 首次部署后执行数据库迁移：

```bash
npx prisma migrate deploy
```

早期个人原型也可以用：

```bash
npx prisma db push
```

Vercel 构建时会通过 `postinstall` 自动运行 `prisma generate`。

## 环境变量

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"

ZOTERO_API_KEY=""
ZOTERO_LIBRARY_ID=""
ZOTERO_LIBRARY_TYPE="user"
ZOTERO_COLLECTION_KEY=""
ZOTERO_SYNC_LIMIT="100"

OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
AI_MODEL=""
```

`ZOTERO_LIBRARY_TYPE` 可选 `user` 或 `group`。`ZOTERO_COLLECTION_KEY` 留空时同步库中的顶层条目；填写后只同步指定 collection。

## Zotero 同步

文献管理默认不要求手动导入。配置 Zotero API 后，进入文献页点击“同步 Zotero”，系统会读取 Zotero Web API v3 的条目数据并写入本平台：

- 标题、作者、年份、摘要、来源、DOI、URL。
- Zotero 标签和 collection 信息。
- 平台内保留阅读状态和阅读笔记，不覆盖用户已写的阅读状态。

平台不会上传或同步 PDF 附件，也不会替代 Zotero 的引用样式、文献库和 PDF 管理能力。

## 本地开发

本地开发同样使用 PostgreSQL，保持和 Vercel 一致：

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 常用脚本

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run lint         # ESLint 检查
npm run db:generate  # 生成 Prisma Client
npm run db:push      # 原型阶段同步 schema 到数据库
npm run db:deploy    # 部署环境执行 Prisma migration
npm run db:seed      # 写入种子数据
npm run db:studio    # 打开 Prisma Studio
```

## 导出

设置页提供 JSON 和 BibTeX 导出按钮，也可以直接访问：

```text
/api/export
/api/export/bibtex
```

JSON 导出包含所有 MVP 表和记录计数。BibTeX 导出只包含文献条目，方便接入 Zotero、JabRef、LaTeX 或其他参考文献工具。

## 开源边界

首版不做登录、多用户、PDF 上传、DOI 自动抓取、RAG 问答、甘特图和知识图谱。优先做真实可用的个人工作台，再按需求接入成熟工具：

- Zotero：文献同步和 BibTeX 导出。
- Obsidian/Logseq：Markdown 导出或 vault 同步。
- MLflow/DVC：后续做自动集成，不把手工字段堆到日常界面里。
- Supabase/S3：后续处理 PDF、图片和大文件存储。

## 开源说明

- `LICENSE`：MIT License。
- `CONTRIBUTING.md`：本地开发、验证和贡献边界。
- `SECURITY.md`：当前 MVP 的安全边界。
- `ROADMAP.md`：后续版本路线。
- `.github/ISSUE_TEMPLATE/`：bug 和 feature issue 模板。
