import {
  Bot,
  Database,
  Download,
  FileText,
  KeyRound,
  Settings,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import { updateAiSettings } from "@/lib/actions";
import { isAccessControlEnabled } from "@/lib/auth";
import { Field } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
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
  const [zotero, aiSettings, counts] = await Promise.all([
    Promise.resolve(getZoteroConfigStatus()),
    getAiSettings(),
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
  ]);

  const totalRecords = counts.reduce((sum, count) => sum + count, 0);
  const databaseReady = Boolean(process.env.DATABASE_URL);
  const accessReady = isAccessControlEnabled();
  const encryptionReady = Boolean(process.env.APP_ENCRYPTION_KEY);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="设置"
        title="设置中心"
        description="这里保留真正会变动的东西：AI 连接、数据导出和部署健康状态。"
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
        <HealthCard label="数据库" ready={databaseReady} detail="保存所有研究记录" icon={Database} />
        <HealthCard label="访问保护" ready={accessReady} detail="公开部署前建议开启" icon={ShieldCheck} />
        <HealthCard label="Zotero" ready={zotero.ready} detail="同步文献元数据" icon={UploadCloud} />
        <HealthCard label="AI Key" ready={aiSettings.apiKeyConfigured} detail="用于后续助手能力" icon={Bot} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-lg bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4" />
              AI 连接
            </CardTitle>
            <CardDescription>常换的 Key、模型和代理地址放这里，不用登录服务器改配置。</CardDescription>
          </CardHeader>
          <CardContent>
            <AiSettingsForm settings={aiSettings} encryptionReady={encryptionReady} />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="rounded-lg bg-white/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4" />
                当前状态
              </CardTitle>
              <CardDescription>只看结论，不展示密钥。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <InfoRow label="模型" value={aiSettings.model} />
              <InfoRow label="Base URL" value={aiSettings.baseUrl} />
              <InfoRow label="记录数" value={`${totalRecords} 条`} />
            </CardContent>
          </Card>

          <Card className="rounded-lg bg-white/95">
            <CardHeader>
              <CardTitle>备份</CardTitle>
              <CardDescription>搬家、重部署或整理资料前导出一次。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <a className={buttonVariants({ variant: "outline" })} href="/api/export" download>
                <Download className="size-4" />
                导出完整 JSON
              </a>
              <a className={buttonVariants({ variant: "outline" })} href="/api/export/bibtex" download>
                <FileText className="size-4" />
                导出文献 BibTeX
              </a>
            </CardContent>
          </Card>
        </div>
      </section>

      <details className="rounded-lg border bg-white/95 p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Settings className="size-4" />
          高级部署信息
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>部署环境</CardTitle>
              <CardDescription>这些通常只在第一次部署时配置。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                ["DATABASE_URL", databaseReady],
                ["APP_PASSWORD", accessReady],
                ["APP_ENCRYPTION_KEY", encryptionReady],
                ["ZOTERO_API_KEY", zotero.hasApiKey],
                ["ZOTERO_LIBRARY_ID", Boolean(zotero.libraryId)],
              ].map(([name, ready]) => (
                <EnvStatus key={String(name)} label={String(name)} ready={Boolean(ready)} />
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>部署顺序</CardTitle>
              <CardDescription>给第一次上线看的清单。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <p>1. 复制 `.env.server.example` 为 `.env`。</p>
              <p>2. 修改访问密码、数据库密码和加密密钥。</p>
              <p>3. 执行 `docker compose up -d --build`。</p>
              <p>4. 访问服务器的 `3000` 端口，登录后同步 Zotero。</p>
              <p>5. 在这里填写 AI Key、Base URL 和模型名。</p>
            </CardContent>
          </Card>
        </div>
      </details>
    </div>
  );
}

function AiSettingsForm({
  settings,
  encryptionReady,
}: {
  settings: {
    provider: "openai" | "anthropic" | "custom";
    baseUrl: string;
    model: string;
    apiKeyConfigured: boolean;
  };
  encryptionReady: boolean;
}) {
  return (
    <form action={updateAiSettings} className="grid gap-3">
      {!encryptionReady ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          保存 API Key 前，需要先在服务器 `.env` 中设置 `APP_ENCRYPTION_KEY`。
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="服务商">
          <select
            name="provider"
            defaultValue={settings.provider}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="openai">OpenAI 兼容</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">自定义接口</option>
          </select>
        </Field>
        <Field label="模型">
          <Input name="model" defaultValue={settings.model} required />
        </Field>
        <Field label="API Key">
          <Input
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={settings.apiKeyConfigured ? "已配置，留空不改" : "粘贴 Key"}
          />
        </Field>
      </div>
      <Field label="Base URL">
        <Input name="baseUrl" defaultValue={settings.baseUrl} required />
      </Field>
      <p className="text-xs text-muted-foreground">
        Key 留空表示不修改；输入 `CLEAR` 可以清除当前 Key。
      </p>
      <SubmitButton className="w-fit">保存 AI 连接</SubmitButton>
    </form>
  );
}

function HealthCard({
  label,
  ready,
  detail,
  icon: Icon,
}: {
  label: string;
  ready: boolean;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-lg bg-white/95">
      <CardContent className="flex items-center justify-between gap-3 py-4">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span
          className={
            ready
              ? "flex size-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "flex size-9 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-500"
          }
        >
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
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
