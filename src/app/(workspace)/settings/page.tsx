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
  type LucideIcon,
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
  const connectionShortcuts = [
    {
      action: "打开 AI 连接",
      detail: `${providerLabel(aiSettings.provider)} · ${aiSettings.model}`,
      href: "#ai-connection",
      icon: Bot,
      ready: aiSettings.apiKeyConfigured,
      title: aiSettings.apiKeyConfigured ? "更换 AI Key / Base URL" : "配置 AI 助手",
    },
    {
      action: "打开 Zotero",
      detail: zotero.libraryId
        ? `${zotero.libraryType === "user" ? "个人库" : "群组库"} · ${zotero.libraryId}`
        : "同步前填写 Library ID 和只读 Key",
      href: "#zotero-connection",
      icon: UploadCloud,
      ready: zotero.ready,
      title: zotero.ready ? "调整 Zotero 同步范围" : "连接 Zotero 文献库",
    },
    {
      action: "打开密码",
      detail: accessSettings.source === "settings" ? "当前来自设置中心" : "当前来自 .env 初始配置",
      href: "#access-connection",
      icon: Key,
      ready: accessReady,
      title: accessReady ? "更新访问密码" : "设置访问密码",
    },
  ];

  return (
    <div className="grid gap-5">
      <section className="cockpit-hero overflow-hidden rounded-2xl border border-border/65 px-5 py-5 shadow-[0_18px_48px_rgba(27,42,56,0.07)] md:px-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="research-eyebrow">
                <Settings className="size-3.5" />
                连接中心
              </span>
              <span className="rounded-full border border-white/60 bg-white/58 px-2.5 py-1 text-xs text-muted-foreground">
                AI · Zotero · 访问 · 备份
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight hero-title md:text-[2.55rem]">
              常改的连接放这里。
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 hero-copy">
              AI、Zotero、访问密码和备份。
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

      <section className="grid items-stretch gap-4 xl:grid-cols-[0.35fr_0.65fr]">
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

          <ZoteroQuickGuideCard />
        </aside>

        <div className="stretch-panel gap-4 rounded-2xl border border-border/70 bg-white/58 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_12px_28px_rgba(34,48,71,0.035)]">
          <ConnectionControlPanel shortcuts={connectionShortcuts} />

          <SettingsDetailSection
            defaultOpen={!aiSettings.apiKeyConfigured || feedback.section === "ai"}
            description="常换的 Key、模型和代理地址放这里，不用登录服务器改配置。"
            icon={Bot}
            id="ai-connection"
            ready={aiSettings.apiKeyConfigured}
            title="AI 连接"
          >
              <AiSettingsForm settings={aiSettings} encryptionReady={encryptionReady} />
          </SettingsDetailSection>

          <SettingsDetailSection
            defaultOpen={!zotero.ready || feedback.section === "zotero"}
            description="文献库 API、用户/群组库和同步数量可以随时改。"
            icon={UploadCloud}
            id="zotero-connection"
            ready={zotero.ready}
            title="Zotero 同步"
          >
              <ZoteroSettingsForm settings={zotero} />
          </SettingsDetailSection>

          <SettingsDetailSection
            defaultOpen={!accessReady}
            description={`当前密码来自${accessSettings.source === "settings" ? "设置中心" : ".env 初始配置"}。`}
            icon={Key}
            id="access-connection"
            ready={accessReady}
            title="访问密码"
          >
              <AccessSettingsForm />
          </SettingsDetailSection>
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

function ConnectionControlPanel({
  shortcuts,
}: {
  shortcuts: Array<{
    action: string;
    detail: string;
    href: string;
    icon: LucideIcon;
    ready: boolean;
    title: string;
  }>;
}) {
  return (
    <section className="settings-control-panel rounded-2xl border border-white/72 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold hero-title">
            <KeyRound className="size-4 text-primary" />
            常用连接
          </p>
          <p className="sr-only">
            常改的只有 AI、Zotero 和访问密码。点卡片再改，平时不用看完整表单。
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/72 bg-white/68 px-2.5 py-1 text-xs text-muted-foreground">
          部署项已折叠
        </span>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        {shortcuts.map((item) => {
          const Icon = item.icon;

          return (
            <a key={item.href} href={item.href} className="settings-shortcut-card group">
              <span className="flex items-start justify-between gap-3">
                <span
                  className={
                    item.ready
                      ? "flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d5e4e8] bg-[#eef6f4] text-primary"
                  }
                >
                  <Icon className="size-4" />
                </span>
                <span
                  className={
                    item.ready
                      ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                      : "rounded-full border border-[#ead9ad] bg-[#fff8e7] px-2 py-0.5 text-[11px] font-medium text-[#765a23]"
                  }
                >
                  {item.ready ? "已可用" : "待配置"}
                </span>
              </span>
              <span className="mt-3 block text-sm font-semibold hero-title">{item.title}</span>
              <span className="sr-only">
                {item.detail}
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                {item.action}
                <Settings className="size-3.5 transition group-hover:rotate-12" />
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function SettingsDetailSection({
  children,
  defaultOpen,
  description,
  icon: Icon,
  id,
  ready,
  title,
}: {
  children: React.ReactNode;
  defaultOpen: boolean;
  description: string;
  icon: LucideIcon;
  id: string;
  ready: boolean;
  title: string;
}) {
  return (
    <details id={id} className="settings-detail-card group rounded-2xl border border-white/72 bg-white/90" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4">
        <span className="flex min-w-0 gap-3">
          <span
            className={
              ready
                ? "flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#d5e4e8] bg-[#eef6f4] text-primary"
            }
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold hero-title">{title}</span>
            <span className="sr-only">{description}</span>
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-border/70 bg-white/72 px-2.5 py-1 text-xs text-muted-foreground">
          展开
        </span>
      </summary>
      <div className="border-t border-border/60 p-4 pt-3">
        {children}
      </div>
    </details>
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
    <form action={updateAiSettings} className="grid gap-4">
      {!encryptionReady ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          APP_ENCRYPTION_KEY 未设置
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#d5e4e8] bg-[#f8fbf8]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-start gap-3">
          <span
            className={
              settings.apiKeyConfigured
                ? "flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#cfe0e4] bg-white text-primary"
            }
          >
            <Bot className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--workspace-title)]">
              {settings.apiKeyConfigured ? "AI 草稿助手已接入" : "先接上一个可用的 AI 网关"}
            </p>
            <p className="sr-only">
              这里只维护经常会换的 Key、模型和 Base URL。输入材料仍由你主动粘贴，输出只当草稿。
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-white/72 p-3 md:grid-cols-[0.85fr_1fr]">
        <Field label="服务商">
          <select
            name="provider"
            defaultValue={settings.provider}
            className="h-9 rounded-lg border border-[#d4e0e5] bg-white/90 px-2 text-sm outline-none transition focus:border-primary/40 focus:ring-3 focus:ring-ring/18"
          >
            <option value="openai">OpenAI 兼容</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">自定义接口</option>
          </select>
        </Field>
        <Field label="模型">
          <Input
            name="model"
            defaultValue={settings.model}
            required
            placeholder="例如：gpt-4.1-mini / claude-sonnet-4"
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Base URL" hint="OpenAI 兼容网关通常以 /v1 结尾；Anthropic 可填官方或中转地址。">
            <Input
              name="baseUrl"
              defaultValue={settings.baseUrl}
              required
              className="h-9 border-[#d4e0e5] bg-white/90"
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#d5e4e8] bg-[#fbfcfd]/86 p-3 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="API Key">
          <Input
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder={settings.apiKeyConfigured ? "已配置，留空不改" : "粘贴 Key"}
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
        <SubmitButton formAction={testAiSettings} variant="outline" className="w-fit">
          测试当前配置
        </SubmitButton>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-[#d5e4e8] bg-[#eef6f4] px-3 py-2">
        <p className="sr-only">
          Key 留空表示不修改；输入 `CLEAR` 可以清除当前 Key。
        </p>
        <SubmitButton className="w-fit">保存 AI 连接</SubmitButton>
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
    <form action={updateZoteroSettings} className="grid gap-4">
      <div className="rounded-2xl border border-[#d5e4e8] bg-[#f8fbf8]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-start gap-3">
          <span
            className={
              settings.apiKeyConfigured && settings.libraryId
                ? "flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#cfe0e4] bg-white text-primary"
            }
          >
            <UploadCloud className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--workspace-title)]">
              {settings.apiKeyConfigured && settings.libraryId ? "Zotero 文献源已准备好" : "把 Zotero 当作文献源头接进来"}
            </p>
            <p className="sr-only">
              研途 Hub 不接管 PDF，只同步条目、集合和标签，用来安排阅读和生成笔记。
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-white/72 p-3 sm:grid-cols-[1fr_130px]">
        <Field label="Library ID">
          <Input
            name="libraryId"
            defaultValue={settings.libraryId}
            required
            placeholder="个人库或群组库 ID"
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
        <Field label="类型">
          <select
            name="libraryType"
            defaultValue={settings.libraryType}
            className="h-9 rounded-lg border border-[#d4e0e5] bg-white/90 px-2 text-sm outline-none transition focus:border-primary/40 focus:ring-3 focus:ring-ring/18"
          >
            <option value="user">个人</option>
            <option value="group">群组</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="API Key" hint="留空不改；输入 CLEAR 可以清除当前 Key。">
            <Input
              name="apiKey"
              type="password"
              autoComplete="off"
              placeholder={settings.apiKeyConfigured ? "已配置，留空不改" : "粘贴 Zotero Key"}
              className="h-9 border-[#d4e0e5] bg-white/90"
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#d5e4e8] bg-[#fbfcfd]/86 p-3 sm:grid-cols-[1fr_130px_auto] sm:items-end">
        <Field label="Collection Key">
          <Input
            name="collectionKey"
            defaultValue={settings.collectionKey}
            placeholder="可留空，只同步某个集合时填写"
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
        <Field label="同步数量">
          <Input
            name="syncLimit"
            type="number"
            min={1}
            max={500}
            defaultValue={settings.syncLimit}
            className="h-9 border-[#d4e0e5] bg-white/90"
          />
        </Field>
        <SubmitButton formAction={testZoteroSettings} variant="outline" className="w-fit">
          测试当前配置
        </SubmitButton>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-[#d5e4e8] bg-[#eef6f4] px-3 py-2">
        <p className="sr-only">
          同步数量超过 100 时会自动分页读取；大型库建议先用 Collection Key 分批同步。
        </p>
        <SubmitButton className="w-fit">保存 Zotero</SubmitButton>
      </div>
    </form>
  );
}

function ZoteroQuickGuideCard() {
  const steps = [
    {
      title: "创建只读 API Key",
      detail: "在 Zotero 网页端创建 Key，勾选读取文献库权限即可；研途 Hub 不需要写入 Zotero。",
      action: "打开 Key 页面",
      href: "https://www.zotero.org/settings/keys/new",
    },
    {
      title: "填写 Library ID",
      detail: "个人库填 Zotero userID；群组库填 group ID，并把类型切到“群组”。",
      action: "查看我的 Key",
      href: "https://www.zotero.org/settings/keys",
    },
    {
      title: "按需填写 Collection Key",
      detail: "不填就同步当前库范围；文献很多时，复制某个集合 URL 里的 collections 后缀再分批同步。",
      action: "查看群组",
      href: "https://www.zotero.org/groups",
    },
  ];

  return (
    <Card className="workbench-card bg-white/95">
      <CardHeader className="border-b border-border/70 bg-white/52 pb-4">
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="size-4 text-primary" />
          Zotero 三步连接
        </CardTitle>
        <CardDescription>只同步元数据，不托管 PDF，不替代 Zotero。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {steps.map((step, index) => (
          <div key={step.title} className="soft-tile rounded-xl p-3">
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#d5e4e8] bg-white/80 font-mono text-[11px] font-semibold text-primary">
                0{index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="sr-only">{step.detail}</p>
                <a
                  href={step.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  {step.action}
                </a>
              </div>
            </div>
          </div>
        ))}
        <div className="sr-only">
          常见填错：Collection Key 不是集合名称；个人库和群组库的 Library ID 不能混用；服务器网络访问 Zotero 失败也会导致测试不通过。
        </div>
      </CardContent>
    </Card>
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
      <p className="sr-only">
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
      <p className="sr-only">{detail}</p>
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
    <div className="flex items-center justify-between gap-3 soft-tile rounded-xl p-3">
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
          <p className="sr-only">{detail}</p>
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
