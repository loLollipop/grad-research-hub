import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Key,
  KeyRound,
  Settings,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import {
  testAiSettings,
  testZoteroSettings,
  updateAccessSettings,
  updateAiSettings,
  updateZoteroSettings,
} from "@/lib/actions";
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
import { getAccessSettings, getAiSettings, getZoteroSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    section?: string;
    status?: string;
    message?: string;
  }>;
};

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function providerLabel(value: string) {
  const labels: Record<string, string> = {
    openai: "OpenAI 兼容",
    anthropic: "Anthropic",
    custom: "自定义接口",
  };

  return labels[value] ?? value;
}

export default async function SettingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const feedback = {
    section: valueOf(params.section),
    status: valueOf(params.status),
    message: valueOf(params.message),
  };
  const [zotero, aiSettings, accessSettings, counts] = await Promise.all([
    getZoteroSettings(),
    getAiSettings(),
    getAccessSettings(),
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
  const accessReady = accessSettings.configured;
  const encryptionReady = Boolean(process.env.APP_ENCRYPTION_KEY);
  const connectionStack = [
    {
      title: aiSettings.apiKeyConfigured ? "AI 已可用" : "先配置 AI Key",
      detail: `${providerLabel(aiSettings.provider)} · ${aiSettings.model}`,
      ready: aiSettings.apiKeyConfigured,
    },
    {
      title: zotero.ready ? "Zotero 已连接" : "连接 Zotero 文献库",
      detail: zotero.libraryId
        ? `${zotero.libraryType === "user" ? "个人库" : "群组库"} · ${zotero.libraryId}`
        : "同步文献前需要 Library ID",
      ready: zotero.ready,
    },
    {
      title: accessReady ? "访问保护已开启" : "设置访问密码",
      detail: accessSettings.source === "settings" ? "来自设置中心" : "来自 .env 初始配置",
      ready: accessReady,
    },
  ];

  return (
    <div className="grid gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/76 px-2.5 py-1 text-xs font-medium text-[#274563]">
                <Settings className="size-3.5" />
                连接中心
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                AI · Zotero · 访问 · 备份
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              设置页只放会经常改的连接，不把部署细节塞给用户。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              AI Key、Zotero、访问密码和数据导出在这里处理；数据库、端口、加密密钥等底层部署项继续放在服务器和高级信息里。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a className={buttonVariants({ variant: "default" })} href="/api/export" download>
                <Download className="size-4" />
                导出 JSON
              </a>
              <a className={buttonVariants({ variant: "outline" })} href="/api/export/bibtex" download>
                <FileText className="size-4" />
                导出 BibTeX
              </a>
            </div>
          </div>

          <div className="flex min-h-64 flex-col justify-between rounded-2xl action-stack p-4 text-white shadow-[0_18px_36px_rgba(22,34,53,0.16)]">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-white/68">
                <KeyRound className="size-3.5" />
                今日连接栈
              </p>
              <div className="mt-4 grid gap-2.5">
                {connectionStack.map((item, index) => (
                  <SettingsStackItem
                    key={item.title}
                    index={`0${index + 1}`}
                    title={item.title}
                    detail={item.detail}
                    ready={item.ready}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
              <div>
                <p className="text-lg font-semibold tracking-tight">{totalRecords}</p>
                <p className="mt-0.5 text-[11px] text-white/54">记录</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{databaseReady ? "正常" : "待配"}</p>
                <p className="mt-0.5 text-[11px] text-white/54">数据库</p>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">{encryptionReady ? "已设" : "待设"}</p>
                <p className="mt-0.5 text-[11px] text-white/54">加密</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SettingsFeedback {...feedback} />

      <section className="grid gap-4 xl:grid-cols-[0.35fr_0.65fr]">
        <aside className="grid content-start gap-4">
          <Card className="workbench-card bg-white/95">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                当前状态
              </CardTitle>
              <CardDescription>只看结论，不展示密钥。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <HealthLine label="数据库" ready={databaseReady} detail="保存所有研究记录" icon={Database} />
              <HealthLine label="访问保护" ready={accessReady} detail="公开部署前建议开启" icon={ShieldCheck} />
              <HealthLine label="Zotero" ready={zotero.ready} detail="同步文献元数据" icon={UploadCloud} />
              <HealthLine label="AI Key" ready={aiSettings.apiKeyConfigured} detail="用于助手草稿" icon={Bot} />
            </CardContent>
          </Card>

          <Card className="workbench-card bg-white/95">
            <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
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
        </aside>

        <div className="grid gap-4">
          <Card className="workbench-card bg-white/95">
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

          <Card className="workbench-card bg-white/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadCloud className="size-4" />
                Zotero 同步
              </CardTitle>
              <CardDescription>文献库 API、用户/群组库和同步数量可以随时改。</CardDescription>
            </CardHeader>
            <CardContent>
              <ZoteroSettingsForm settings={zotero} />
            </CardContent>
          </Card>

          <Card className="workbench-card bg-white/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="size-4" />
                访问密码
              </CardTitle>
              <CardDescription>
                当前密码来自{accessSettings.source === "settings" ? "设置中心" : ".env 初始配置"}。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccessSettingsForm />
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
                ["访问密码", accessReady],
                ["APP_ENCRYPTION_KEY", encryptionReady],
                ["Zotero API Key", zotero.apiKeyConfigured],
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
      <div className="flex flex-wrap gap-2">
        <SubmitButton className="w-fit">保存 AI 连接</SubmitButton>
        <SubmitButton formAction={testAiSettings} variant="outline" className="w-fit">
          测试当前配置
        </SubmitButton>
      </div>
    </form>
  );
}

function ZoteroSettingsForm({
  settings,
}: {
  settings: {
    apiKeyConfigured: boolean;
    libraryId: string;
    libraryType: "user" | "group";
    collectionKey: string;
    syncLimit: number;
  };
}) {
  return (
    <form action={updateZoteroSettings} className="grid gap-3">
      <Field label="API Key">
        <Input
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder={settings.apiKeyConfigured ? "已配置，留空不改" : "粘贴 Zotero Key"}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
        <Field label="Library ID">
          <Input name="libraryId" defaultValue={settings.libraryId} required />
        </Field>
        <Field label="类型">
          <select
            name="libraryType"
            defaultValue={settings.libraryType}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="user">个人</option>
            <option value="group">群组</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
        <Field label="Collection Key">
          <Input name="collectionKey" defaultValue={settings.collectionKey} placeholder="可留空" />
        </Field>
        <Field label="同步数量">
          <Input name="syncLimit" type="number" min={1} max={500} defaultValue={settings.syncLimit} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        API Key 留空表示不修改；输入 `CLEAR` 可以清除当前 Key。
      </p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton className="w-fit">保存 Zotero</SubmitButton>
        <SubmitButton formAction={testZoteroSettings} variant="outline" className="w-fit">
          测试当前配置
        </SubmitButton>
      </div>
    </form>
  );
}

function AccessSettingsForm() {
  return (
    <form action={updateAccessSettings} className="grid gap-3">
      <Field label="当前密码">
        <Input name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="新密码">
        <Input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="确认新密码">
        <Input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        保存后后续登录使用新密码；已经登录的当前浏览器不会被立刻踢下线。
      </p>
      <SubmitButton className="w-fit">更新密码</SubmitButton>
    </form>
  );
}

function SettingsFeedback({
  section,
  status,
  message,
}: {
  section?: string;
  status?: string;
  message?: string;
}) {
  if (!section || !status || !message) {
    return null;
  }

  const success = status === "success";
  const warning = status === "warning";
  const Icon = success ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={
        success
          ? "rounded-2xl border border-emerald-200 bg-emerald-50/92 px-4 py-3 text-sm text-emerald-900"
          : warning
            ? "rounded-2xl border border-amber-200 bg-amber-50/92 px-4 py-3 text-sm text-amber-950"
            : "rounded-2xl border border-rose-200 bg-rose-50/92 px-4 py-3 text-sm text-rose-950"
      }
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">
            {section === "zotero" ? "Zotero 测试结果" : "AI 测试结果"}
          </p>
          <p className="mt-1 break-words leading-6">{message}</p>
        </div>
      </div>
    </div>
  );
}

function SettingsStackItem({
  index,
  title,
  detail,
  ready,
}: {
  index: string;
  title: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-white/50">{index}</span>
        <span className="h-px flex-1 bg-white/12" />
        <span
          className={
            ready
              ? "rounded-full bg-emerald-300/18 px-2 py-0.5 text-[11px] text-emerald-100"
              : "rounded-full bg-amber-300/18 px-2 py-0.5 text-[11px] text-amber-100"
          }
        >
          {ready ? "已连接" : "待处理"}
        </span>
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 line-clamp-1 text-xs text-white/58">{detail}</p>
    </div>
  );
}

function HealthLine({
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/72 bg-[#fbfcfd]/88 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={
            ready
              ? "flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "flex size-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-500"
          }
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <span
        className={
          ready
            ? "shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
            : "shrink-0 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600"
        }
      >
        {ready ? "已配置" : "待配置"}
      </span>
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
