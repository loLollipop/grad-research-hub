import { LockKeyhole } from "lucide-react";

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
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7f7f2_0%,#ffffff_55%)] px-4">
      <Card className="w-full max-w-sm rounded-lg bg-white/95">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-[#1f3d33] text-white">
            <LockKeyhole className="size-5" />
          </div>
          <CardTitle>进入研途 Hub</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={login} className="grid gap-3">
            <input type="hidden" name="next" value={nextPath} />
            <Input
              name="password"
              type="password"
              placeholder="访问密码"
              autoFocus
              required
            />
            {params.error ? (
              <p className="text-sm text-rose-700">密码不正确，请再试一次。</p>
            ) : null}
            <SubmitButton>进入工作台</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
