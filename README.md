# 研途 Hub / Grad Research Hub

面向理工科研究生的个人科研与日常事务管理平台。它不是 Zotero、Notion 或项目管理套件的替代品，而是一个每天打开就能省时间的工作台：任务、文献阅读、实验记录、笔记、数据结果和组会材料集中在一起。

## 功能范围

- 首页：只看今天最要紧的任务、实验、文献和事务。
- 文献：通过 Zotero Web API 同步文献元数据，平台内维护阅读状态、标签、筛选和笔记。
- 实验：Markdown 实验记录，保留目的、方法、结果、结论和项目/论文关联。
- 项目：看板式任务推进，项目、里程碑和任务通过折叠入口维护。
- 笔记：Markdown 预览、标签、分类和基础 `[[双链]]` 文本识别。
- 数据：数据集登记、实验指标 JSON、简单图表和结果对比。
- 事务：组会、材料、报销、截止事项的状态追踪。
- AI：Key、Base URL 和模型名可在设置中心维护。
- 设置：AI 连接、数据导出、部署健康检查和少量高级信息。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui + lucide-react
- Prisma ORM + PostgreSQL
- zod + Server Actions
- react-markdown + remark-gfm
- recharts

## 快速部署到 Vercel

最省事的路线是：GitHub 仓库 + Vercel + 托管 PostgreSQL。下面按第一次部署的顺序写。

### 1. 导入项目

1. Fork 本仓库，或把代码推到你自己的 GitHub 仓库。
2. 打开 [Vercel Dashboard](https://vercel.com/dashboard)。
3. 点击 `Add New... -> Project`。
4. 选择你的 `grad-research-hub` 仓库并导入。

### 2. 创建数据库并获取 `DATABASE_URL`

`DATABASE_URL` 是 PostgreSQL 数据库连接字符串，不是项目里生成的。任选一种方式：

#### 方式 A：Vercel Marketplace / Neon，推荐

1. 在 Vercel 项目里打开 `Storage` 或 `Marketplace`。
2. 选择 Neon/Postgres 类数据库并创建。
3. 绑定到当前 Vercel 项目。
4. 绑定后通常会自动生成 `DATABASE_URL` 环境变量。

如果没有自动生成，就进入数据库控制台复制连接字符串。它一般长这样：

```env
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

#### 方式 B：Supabase

1. 创建 Supabase 项目。
2. 进入 `Project Settings -> Database`。
3. 找到 `Connection string`，选择 URI 格式。
4. 复制 PostgreSQL URI，填到 Vercel 的 `DATABASE_URL`。

注意：`DATABASE_URL` 不是 `SUPABASE_URL`，也不是 anon key。

### 3. 设置 Vercel 环境变量

在 Vercel 项目中进入：

`Settings -> Environment Variables`

至少填写这些：

| 变量名 | 必填 | 示例/说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 |
| `APP_PASSWORD` | 强烈建议 | 进入工作台的访问密码 |
| `APP_ENCRYPTION_KEY` | 是 | 用来加密设置中心保存的 AI Key |
| `ZOTERO_API_KEY` | 建议 | Zotero Web API Key |
| `ZOTERO_LIBRARY_ID` | 建议 | Zotero user id 或 group id |
| `ZOTERO_LIBRARY_TYPE` | 建议 | `user` 或 `group`，默认 `user` |
| `ZOTERO_COLLECTION_KEY` | 否 | 只同步某个 collection 时填写 |
| `ZOTERO_SYNC_LIMIT` | 否 | 默认 `100` |

`.env.example` 也列出了这些变量。

### 4. 设置 Build Command

Vercel 项目里进入：

`Settings -> Build & Development Settings`

把 Build Command 改成：

```bash
npm run vercel-build
```

这个脚本会先执行数据库迁移，再构建 Next.js：

```bash
prisma migrate deploy && next build
```

如果你不想改 Build Command，也可以部署后在 Vercel/本地手动执行一次：

```bash
npx prisma migrate deploy
```

### 5. 部署

点击 Vercel 的 `Deploy`。部署成功后访问你的 Vercel 域名：

1. 如果设置了 `APP_PASSWORD`，先输入访问密码。
2. 进入文献页，点击同步 Zotero。
3. 进入设置中心，填写 AI Key、Base URL 和模型名。

## Zotero 配置怎么拿

### `ZOTERO_API_KEY`

1. 打开 [Zotero API Keys](https://www.zotero.org/settings/keys)。
2. 创建一个新的 private key。
3. 勾选允许读取 library。
4. 复制生成的 key，填到 Vercel 的 `ZOTERO_API_KEY`。

### `ZOTERO_LIBRARY_ID`

- 个人库：通常是 Zotero 的 user id，可在 Zotero API Keys 页面或 Zotero 设置页面看到。
- 群组库：打开 Zotero group 页面，URL 里的数字 id 通常就是 group id。

### `ZOTERO_LIBRARY_TYPE`

```env
ZOTERO_LIBRARY_TYPE="user"
```

如果同步群组库，改成：

```env
ZOTERO_LIBRARY_TYPE="group"
```

### `ZOTERO_COLLECTION_KEY`

可不填。不填时同步库里的顶层条目。后续如果只想同步某个 collection，再填 collection key。

## AI 设置中心

AI 的 API Key、Base URL 和模型名属于高频变动项，部署后直接在设置页修改，不需要每次去 Vercel 改环境变量。

- API Key 加密后写入数据库，页面只显示“已配置/未配置”。
- API Key 输入框留空表示不修改当前 Key。
- 输入 `CLEAR` 可以清除当前保存的 Key。
- `APP_ENCRYPTION_KEY` 只建议首次部署时生成一次强随机字符串。部署后更换它会导致旧 AI Key 无法解密。

## 本地开发

本地开发同样推荐 PostgreSQL，保持和 Vercel 一致：

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
npm run vercel-build # Vercel 构建：迁移数据库并构建应用
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

首版不做多用户、PDF 上传、DOI 自动抓取、RAG 问答、甘特图和知识图谱。优先做真实可用的个人工作台，再按需求接入成熟工具：

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

## 参考文档

- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel Storage / Marketplace](https://vercel.com/docs/storage)
- [Neon on Vercel](https://neon.com/docs/guides/vercel)
- [Prisma migrate deploy](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)
- [Zotero Web API v3](https://www.zotero.org/support/dev/web_api/v3/start)
