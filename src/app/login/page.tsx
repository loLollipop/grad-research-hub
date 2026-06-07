import { GraduationCap, LockKeyhole } from "lucide-react";

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
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border bg-white shadow-[0_22px_66px_rgba(15,23,42,0.12)] md:grid-cols-[0.95fr_1fr]">
        <section className="hidden border-r bg-[linear-gradient(180deg,#f8faf7_0%,#eef3f2_100%)] p-8 text-foreground md:flex md:flex-col md:justify-between">
          <div>
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(30,90,120,0.14)]">
              <GraduationCap className="size-5" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">研途 Hub</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              把文献、实验、项目和笔记收进一个安静的研究生工作台。
            </p>
          </div>
          <p className="text-xs text-muted-foreground">自托管 · 单人科研管理 · 中文优先</p>
        </section>

        <Card className="w-full rounded-none border-0 bg-white shadow-none ring-0">
          <CardHeader className="pt-8">
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <LockKeyhole className="size-5" />
            </div>
            <CardTitle>进入研途 Hub</CardTitle>
          </CardHeader>
          <CardContent className="pb-8">
            <form action={login} className="grid gap-3">
              <input type="hidden" name="next" value={nextPath} />
              <Input
                name="password"
                type="password"
                placeholder="访问密码"
                autoFocus
                required
                className="h-10"
              />
              {params.error ? (
                <p className="text-sm text-rose-700">密码不正确，请再试一次。</p>
              ) : null}
              <SubmitButton className="h-10">进入工作台</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
