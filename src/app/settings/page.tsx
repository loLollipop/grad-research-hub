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

import { updateAiSettings } from "@/lib/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db";
import { getAiSettings } from "@/lib/settings";
import { getZoteroConfigStatus } from "@/lib/zotero";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const zotero = getZoteroConfigStatus();
  const aiSettings = await getAiSettings();
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
            <CardDescription>高频变动项可以直接在这里修改，Key 不会完整回显。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <EnvStatus label="运行时 API Key" ready={aiSettings.apiKeyConfigured} />
            <InfoRow label="当前模型" value={aiSettings.model} />
            <InfoRow label="Base URL" value={aiSettings.baseUrl} />
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">编辑 AI 连接</summary>
              <AiSettingsForm settings={aiSettings} />
            </details>
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
              "APP_ENCRYPTION_KEY",
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
            <p>3. 配置 Zotero 变量和 `APP_ENCRYPTION_KEY`。</p>
            <p>4. 首次部署后执行 Prisma migration，再访问文献页同步 Zotero。</p>
            <p>5. AI 的 Key、Base URL 和模型名可以在设置中心随时更新。</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function AiSettingsForm({
  settings,
}: {
  settings: {
    provider: "openai" | "anthropic" | "custom";
    baseUrl: string;
    model: string;
    apiKeyConfigured: boolean;
  };
}) {
  return (
    <form action={updateAiSettings} className="mt-3 grid gap-3">
      <Field label="服务商">
        <select
          name="provider"
          defaultValue={settings.provider}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="openai">OpenAI 兼容</option>
          <option value="anthropic">Anthropic</option>
          <option value="custom">自定义兼容接口</option>
        </select>
      </Field>
      <Field label="Base URL">
        <Input name="baseUrl" defaultValue={settings.baseUrl} required />
      </Field>
      <Field label="模型名">
        <Input name="model" defaultValue={settings.model} required />
      </Field>
      <Field
        label="API Key"
        hint={settings.apiKeyConfigured ? "留空表示不修改；输入 CLEAR 可以清除当前 Key。" : "保存后只显示配置状态，不回显完整 Key。"}
      >
        <Input
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder={settings.apiKeyConfigured ? "已配置，留空不改" : "粘贴新的 API Key"}
        />
      </Field>
      <SubmitButton>保存 AI 配置</SubmitButton>
    </form>
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
