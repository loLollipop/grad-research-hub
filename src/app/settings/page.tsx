import {
  Bot,
  Database,
  Download,
  FileText,
  KeyRound,
  Server,
  Settings,
  UploadCloud,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getZoteroConfigStatus } from "@/lib/zotero";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const zotero = getZoteroConfigStatus();
  const counts = await Promise.all([
    prisma.paper.count(),
    prisma.project.count(),
    prisma.task.count(),
    prisma.experiment.count(),
    prisma.note.count(),
    prisma.dataset.count(),
    prisma.result.count(),
    prisma.adminItem.count(),
  ]);

  const totalRecords = counts.reduce((sum, count) => sum + count, 0);
  const databaseUrl = process.env.DATABASE_URL ?? "";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="设置"
        title="设置中心"
        description="部署时固定的参数放到 Vercel 环境变量；页面只显示配置状态和常用导出入口。"
        actions={
          <>
            <a className={buttonVariants({ variant: "outline" })} href="/api/export/bibtex" download>
              <FileText className="size-4" />
              导出 BibTeX
            </a>
            <a className={buttonVariants({ variant: "default" })} href="/api/export" download>
              <Download className="size-4" />
              导出 JSON
            </a>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "数据记录", value: totalRecords, icon: Database },
          { label: "文献", value: counts[0], icon: FileText },
          { label: "项目任务", value: counts[1] + counts[2], icon: Settings },
          { label: "实验笔记", value: counts[3] + counts[4], icon: KeyRound },
        ].map((item) => (
          <Card key={item.label} className="rounded-lg bg-white/95">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{item.value}</p>
              </div>
              <item.icon className="size-5 text-[#1f3d33]" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-4" />
              Vercel 数据库
            </CardTitle>
            <CardDescription>生产部署建议使用 Vercel Postgres、Neon 或 Supabase。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <EnvStatus label="DATABASE_URL" ready={Boolean(databaseUrl)} />
            <InfoRow
              label="当前类型"
              value={databaseUrl.startsWith("postgres") ? "PostgreSQL" : "未识别或未配置"}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              首次部署后运行 `npx prisma migrate deploy`，或在早期原型阶段使用
              `npx prisma db push`。
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="size-4" />
              Zotero 同步
            </CardTitle>
            <CardDescription>文献条目优先从 Zotero Web API 同步。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <EnvStatus label="ZOTERO_API_KEY" ready={zotero.hasApiKey} />
            <EnvStatus label="ZOTERO_LIBRARY_ID" ready={Boolean(zotero.libraryId)} />
            <InfoRow label="库类型" value={zotero.libraryType === "group" ? "群组库" : "个人库"} />
            <InfoRow label="集合范围" value={zotero.collectionKey || "全部顶层条目"} />
          </CardContent>
        </Card>

        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4" />
              AI 配置
            </CardTitle>
            <CardDescription>密钥只在服务端读取，页面不保存也不回显。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <EnvStatus label="OPENAI_API_KEY" ready={Boolean(process.env.OPENAI_API_KEY)} />
            <EnvStatus label="ANTHROPIC_API_KEY" ready={Boolean(process.env.ANTHROPIC_API_KEY)} />
            <InfoRow label="默认模型" value={process.env.AI_MODEL || "未设置"} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>Vercel 环境变量</CardTitle>
            <CardDescription>这些值在部署平台配置，不需要出现在日常页面里。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              "DATABASE_URL",
              "ZOTERO_API_KEY",
              "ZOTERO_LIBRARY_ID",
              "ZOTERO_LIBRARY_TYPE",
              "ZOTERO_COLLECTION_KEY",
              "OPENAI_API_KEY",
              "ANTHROPIC_API_KEY",
              "AI_MODEL",
            ].map((name) => (
              <code key={name} className="rounded-md border bg-[#fffdf7] px-3 py-2 text-sm">
                {name}
              </code>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>部署步骤</CardTitle>
            <CardDescription>面向 GitHub + Vercel 的主流程。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>1. 在 Vercel 导入 GitHub 仓库。</p>
            <p>2. 绑定 PostgreSQL 数据库，并配置 `DATABASE_URL`。</p>
            <p>3. 配置 Zotero 和 AI 相关环境变量。</p>
            <p>4. 首次部署后执行 Prisma migration，再访问文献页同步 Zotero。</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-all text-xs">{value}</span>
    </div>
  );
}

function EnvStatus({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="font-mono text-xs">{label}</span>
      <span
        className={
          ready
            ? "rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
            : "rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600"
        }
      >
        {ready ? "已配置" : "未配置"}
      </span>
    </div>
  );
}
