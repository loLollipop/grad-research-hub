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

## 产品方向

研途 Hub 会优先做“需求大、每天会用”的科研工作流：今日下一步、Zotero 阅读队列、轻量实验日志、课题推进、笔记连接、结果证据和组会/材料/报销提醒。完整调研与优化计划见 [docs/research-driven-optimization-plan.md](docs/research-driven-optimization-plan.md)。

## 推荐部署方式

推荐部署到一台普通 Linux 服务器，用 Docker Compose 同时启动：

- `app`：Next.js 应用
- `db`：PostgreSQL 数据库

这样不需要另外购买托管数据库，也不用在多个平台之间来回复制连接串。

## 服务器要求

最低建议：

- Ubuntu 22.04 / Debian 12 / 其他常见 Linux 发行版
- 1 核 CPU
- 1 GB 内存，建议 2 GB 以上
- 10 GB 磁盘空间
- 已安装 Docker 和 Docker Compose

安装 Docker 可参考官方文档：[Install Docker Engine](https://docs.docker.com/engine/install/)。

## 一键部署

### 1. 克隆项目

```bash
git clone https://github.com/loLollipop/grad-research-hub.git
cd grad-research-hub
```

### 2. 创建配置文件

```bash
cp .env.server.example .env
```

编辑 `.env`：

```bash
nano .env
```

至少改这几个：

```env
APP_PASSWORD=你的登录密码
APP_ENCRYPTION_KEY=一段很长的随机字符串
POSTGRES_PASSWORD=一段数据库密码
```

可以用下面命令生成随机字符串。数据库密码建议用十六进制，避免特殊字符影响连接字符串：

```bash
openssl rand -hex 24
```

### 3. 启动

```bash
docker compose up -d --build
```

启动后访问：

```text
http://服务器IP:3000
```

第一次打开会要求输入 `APP_PASSWORD`。

### 4. 查看运行状态

```bash
docker compose ps
docker compose logs -f app
```

应用容器启动时会自动执行数据库迁移，不需要手动建表。

## `.env` 配置说明

服务器部署主要配置这个文件：`.env`

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `APP_PORT` | 否 | 应用端口，默认 `3000` |
| `APP_PASSWORD` | 是 | 登录研途 Hub 的访问密码 |
| `APP_ENCRYPTION_KEY` | 是 | 加密设置中心保存的 AI Key |
| `POSTGRES_DB` | 否 | 数据库名，默认 `grad_research_hub` |
| `POSTGRES_USER` | 否 | 数据库用户，默认 `gradhub` |
| `POSTGRES_PASSWORD` | 是 | PostgreSQL 数据库密码 |
| `ZOTERO_API_KEY` | 建议 | Zotero Web API Key |
| `ZOTERO_LIBRARY_ID` | 建议 | Zotero user id 或 group id |
| `ZOTERO_LIBRARY_TYPE` | 建议 | `user` 或 `group`，默认 `user` |
| `ZOTERO_COLLECTION_KEY` | 否 | 只同步某个 collection 时填写 |
| `ZOTERO_SYNC_LIMIT` | 否 | 默认 `100` |

`DATABASE_URL` 不需要手动填写。Docker Compose 会根据数据库配置自动传给应用容器。

## Nginx 反向代理，可选

如果你有域名，建议用 Nginx 把 `3000` 端口代理到 HTTPS。

示例：

```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

HTTPS 可以用 Certbot：

```bash
sudo certbot --nginx -d your-domain.com
```

## 更新项目

```bash
git pull
docker compose up -d --build
```

更新时会保留 PostgreSQL 数据卷。不要随便删除 Docker volume。

## 备份和恢复

### 备份数据库

```bash
docker compose exec db pg_dump -U gradhub grad_research_hub > backup.sql
```

如果你修改了 `POSTGRES_USER` 或 `POSTGRES_DB`，把命令里的用户名和数据库名替换成自己的。

### 恢复数据库

```bash
cat backup.sql | docker compose exec -T db psql -U gradhub grad_research_hub
```

设置页也提供 JSON 和 BibTeX 导出，适合轻量备份和迁移前检查。

## Zotero 配置

文献管理默认不要求手动导入。配置 Zotero API 后，进入文献页点击“同步 Zotero”，系统会读取 Zotero Web API v3 的条目数据并写入本平台。

### `ZOTERO_API_KEY`

1. 打开 [Zotero API Keys](https://www.zotero.org/settings/keys)。
2. 创建一个新的 private key。
3. 勾选允许读取 library。
4. 复制生成的 key，填到服务器 `.env` 的 `ZOTERO_API_KEY`。
5. 修改后重启：

```bash
docker compose up -d
```

### `ZOTERO_LIBRARY_ID`

- 个人库：通常是 Zotero 的 user id，可在 Zotero API Keys 页面或 Zotero 设置页面看到。
- 群组库：打开 Zotero group 页面，URL 里的数字 id 通常就是 group id。

### `ZOTERO_LIBRARY_TYPE`

个人库：

```env
ZOTERO_LIBRARY_TYPE=user
```

群组库：

```env
ZOTERO_LIBRARY_TYPE=group
```

### `ZOTERO_COLLECTION_KEY`

可不填。不填时同步库里的顶层条目。后续如果只想同步某个 collection，再填 collection key。

## AI 设置中心

AI 的 API Key、Base URL 和模型名属于高频变动项，部署后直接在设置页修改，不需要登录服务器改 `.env`。

- API Key 加密后写入数据库，页面只显示“已配置/未配置”。
- API Key 输入框留空表示不修改当前 Key。
- 输入 `CLEAR` 可以清除当前保存的 Key。
- `APP_ENCRYPTION_KEY` 只建议首次部署时生成一次强随机字符串。部署后更换它会导致旧 AI Key 无法解密。

## 本地开发

本地开发推荐直接使用 Docker 数据库：

```bash
cp .env.server.example .env
docker compose up -d db
npm install
npm run db:push
npm run db:seed
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 常用脚本

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run start        # 启动生产 Next.js
npm run server:start # 容器内启动：迁移数据库并启动应用
npm run lint         # ESLint 检查
npm run db:generate  # 生成 Prisma Client
npm run db:push      # 原型阶段同步 schema 到数据库
npm run db:deploy    # 执行 Prisma migration
npm run db:seed      # 写入种子数据
npm run db:studio    # 打开 Prisma Studio
```

## 开源边界

首版不做多用户、PDF 上传、DOI 自动抓取、RAG 问答、甘特图和知识图谱。优先做真实可用的个人工作台，再按需求接入成熟工具：

- Zotero：文献同步和 BibTeX 导出。
- Obsidian/Logseq：Markdown 导出或 vault 同步。
- MLflow/DVC：后续做自动集成，不把手工字段堆到日常界面里。
- Supabase/S3：后续处理 PDF、图片和大文件存储。

## 参考文档

- [Docker Compose](https://docs.docker.com/compose/)
- [PostgreSQL Docker image](https://hub.docker.com/_/postgres)
- [Prisma migrate deploy](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)
- [Zotero Web API v3](https://www.zotero.org/support/dev/web_api/v3/start)
