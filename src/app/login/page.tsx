import {
  BookOpenText,
  CheckCircle2,
  FileChartColumn,
  FlaskConical,
  GraduationCap,
  LockKeyhole,
  Sparkles,
} from "lucide-react";

import { login } from "@/app/login/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const nextPath = params.next ?? "/";

  return (
    <main className="workbench-surface flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/52 shadow-[0_28px_88px_rgba(32,46,52,0.12)] backdrop-blur-xl md:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden border-r border-white/70 bg-[linear-gradient(145deg,rgba(255,254,248,0.82),rgba(236,247,242,0.68))] p-8 text-foreground md:flex md:flex-col md:justify-between">
          <div className="absolute -left-20 -top-20 size-56 rounded-full bg-[#d8eee7]/70 blur-3xl" />
          <div className="absolute -bottom-24 right-4 size-64 rounded-full bg-[#dcdff3]/60 blur-3xl" />
          <div>
            <div className="relative flex items-center gap-3">
              <div className="brand-mark">
                <GraduationCap className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight">研途 Hub</p>
                <p className="text-xs text-muted-foreground">轻量科研行动台</p>
              </div>
            </div>
            <h1 className="relative mt-8 max-w-md text-3xl font-semibold leading-tight tracking-tight hero-title">
              登录后只看自己的研究流，不暴露工作台内容。
            </h1>
            <p className="relative mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              文献交给 Zotero，实验留在记录纸，结果沉淀成证据，最后回到笔记和周报。
            </p>
            <div className="relative mt-7 grid gap-2">
              <LoginFlowStep index="01" icon={BookOpenText} label="文献输入" value="同步后只推进三篇" />
              <LoginFlowStep index="02" icon={FlaskConical} label="实验验证" value="写目的、观察、结论" />
              <LoginFlowStep index="03" icon={FileChartColumn} label="结果证据" value="判断能不能讲" />
              <LoginFlowStep index="04" icon={CheckCircle2} label="写作输出" value="周报、组会、论文素材" />
            </div>
          </div>
          <p className="relative text-xs text-muted-foreground">
            自托管 · 单人科研管理 · 中文优先 · 登录前不展示任何工作台数据
          </p>
        </section>

        <Card className="w-full rounded-none border-0 bg-white/74 shadow-none ring-0">
          <CardHeader className="px-6 pt-7 md:px-8 md:pt-10">
            <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(34,57,71,0.16)]">
              <LockKeyhole className="size-5" />
            </div>
            <CardTitle className="text-2xl">进入研途 Hub</CardTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              输入部署时设置的访问密码。AI Key、Zotero Key 和同步范围登录后在设置中心维护。
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-7 md:px-8 md:pb-10">
            <form action={login} className="grid gap-3">
              <input type="hidden" name="next" value={nextPath} />
              <Input
                name="password"
                type="password"
                placeholder="访问密码"
                autoFocus
                required
                className="h-11 rounded-xl border-border/70 bg-white/82 text-base"
              />
              {params.error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  密码不正确，请再试一次。
                </p>
              ) : null}
              <SubmitButton className="h-11 rounded-xl">
                <Sparkles className="size-4" />
                进入工作台
              </SubmitButton>
            </form>
            <div className="mt-5 rounded-2xl border border-dashed border-[#d5e2dc] bg-white/56 px-3 py-3 text-xs leading-5 text-muted-foreground">
              这是个人自托管入口，不做多用户协作和复杂权限。先保护工作台，再进入当天研究流。
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function LoginFlowStep({
  icon: Icon,
  index,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  index: string;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 rounded-2xl border border-white/70 bg-white/58 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
      <span className="flex size-9 items-center justify-center rounded-xl border border-[#d5e4e8] bg-[#eef6f7] text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-muted-foreground">{index}</span>
          <span className="h-px w-5 bg-border/70" />
          <span className="text-sm font-medium hero-title">{label}</span>
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{value}</span>
      </span>
    </div>
  );
}
