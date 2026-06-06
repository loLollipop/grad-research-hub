import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { Database, Download, FileText, KeyRound, Server, Settings } from "lucide-react";

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

export const dynamic = "force-dynamic";

function databaseFileInfo() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) {
    return { path: url || "未配置", exists: false, size: null };
  }

  const relativePath = url.replace(/^file:/, "");
  const absolutePath = join(process.cwd(), "prisma", relativePath.replace(/^\.\//, ""));
  if (!existsSync(absolutePath)) {
    return { path: absolutePath, exists: false, size: null };
  }

  return {
    path: absolutePath,
    exists: true,
    size: statSync(absolutePath).size,
  };
}

export default async function SettingsPage() {
  const [counts, dbFile] = await Promise.all([
    Promise.all([
      prisma.paper.count(),
      prisma.project.count(),
      prisma.task.count(),
      prisma.experiment.count(),
      prisma.note.count(),
      prisma.dataset.count(),
      prisma.result.count(),
      prisma.adminItem.count(),
    ]),
    Promise.resolve(databaseFileInfo()),
  ]);

  const totalRecords = counts.reduce((sum, count) => sum + count, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Settings"
        title="设置与导出"
        description="检查本地数据库、环境变量和导出入口，为自托管和后续开源部署留出清晰边界。"
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
          { label: "项目", value: counts[1], icon: Settings },
          { label: "实验", value: counts[3], icon: Server },
          { label: "笔记", value: counts[4], icon: KeyRound },
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

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>数据库状态</CardTitle>
            <CardDescription>首版使用 SQLite，便于本机和小服务器快速运行。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <InfoRow label="DATABASE_URL" value={process.env.DATABASE_URL ?? "未配置"} />
            <InfoRow label="SQLite 文件" value={dbFile.path} />
            <InfoRow label="文件状态" value={dbFile.exists ? "已创建" : "未找到"} />
            <InfoRow
              label="文件大小"
              value={dbFile.size === null ? "未知" : `${Math.round(dbFile.size / 1024)} KB`}
            />
          </CardContent>
        </Card>

        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>环境变量</CardTitle>
            <CardDescription>真实密钥只在服务端读取，前端只显示是否配置。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <EnvStatus label="OPENAI_API_KEY" ready={Boolean(process.env.OPENAI_API_KEY)} />
            <EnvStatus label="ANTHROPIC_API_KEY" ready={Boolean(process.env.ANTHROPIC_API_KEY)} />
            <EnvStatus label="DATABASE_URL" ready={Boolean(process.env.DATABASE_URL)} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>本地运行</CardTitle>
            <CardDescription>初始化数据库、种子数据和开发服务器。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {["npm install", "npm run db:init", "npm run dev"].map((command) => (
              <code key={command} className="rounded-md border bg-[#fffdf7] px-3 py-2 text-sm">
                {command}
              </code>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle>迁移方向</CardTitle>
            <CardDescription>后续切到 PostgreSQL/Supabase 时优先保持 schema 约束稳定。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>将 `provider` 切换为 `postgresql`，并把 `DATABASE_URL` 指向托管数据库。</p>
            <p>标签字段当前用 JSON 字符串兼容 SQLite，迁移时可保留字符串或改为关系表。</p>
            <p>文件上传、PDF 管理和 RAG 索引建议在 v1.1 之后接入对象存储。</p>
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
      <span className="break-all font-mono text-xs">{value}</span>
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
