import { ClipboardList, MapPin, Plus, Trash2 } from "lucide-react";
import type { AdminItem, Prisma } from "@prisma/client";

import {
  createAdminItem,
  deleteAdminItem,
  setAdminStatus,
  updateAdminItem,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, parseTags, statusLabel } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateDialog } from "@/components/shared/create-dialog";
import { Field } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { TagList } from "@/components/shared/tag-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; type?: string; status?: string }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q)?.trim();
  const type = first(params.type);
  const status = first(params.status);

  const where: Prisma.AdminItemWhereInput = {};
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { location: { contains: q } },
      { notes: { contains: q } },
      { tags: { contains: q } },
    ];
  }
  if (type && ["meeting", "material", "reimbursement", "deadline"].includes(type)) {
    where.type = type;
  }
  if (status && ["todo", "doing", "done"].includes(status)) {
    where.status = status;
  }

  const [items, counts] = await Promise.all([
    prisma.adminItem.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.adminItem.groupBy({ by: ["type"], _count: true }),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="事务"
        title="轻行政事务"
        description="组会、材料、报销、截止日期这些碎片事项和科研任务一起管理，减少遗漏。"
        actions={
          <CreateDialog
            title="新增事务"
            description="适合记录组会安排、学院材料、报销进度和硬截止。"
            label="新增事务"
            icon={Plus}
            wide
          >
            <AdminItemForm action={createAdminItem} />
          </CreateDialog>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[0.42fr_1.58fr]">
        <div className="grid gap-4">
          <Card className="bg-white/95">
            <CardHeader>
              <CardTitle>事务分布</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {["meeting", "material", "reimbursement", "deadline"].map((key) => (
                <div key={key} className="flex justify-between rounded-md border px-3 py-2">
                  <span>{statusLabel(key)}</span>
                  <span className="text-muted-foreground">
                    {counts.find((item) => item.type === key)?._count ?? 0}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3">
          <form className="grid gap-2 rounded-lg border bg-white/95 p-3 md:grid-cols-[1fr_150px_150px_auto]">
            <Input name="q" placeholder="搜索事务、地点、备注、标签" defaultValue={q} />
            <select
              name="type"
              defaultValue={type ?? ""}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部类型</option>
              <option value="meeting">组会</option>
              <option value="material">材料</option>
              <option value="reimbursement">报销</option>
              <option value="deadline">截止</option>
            </select>
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">全部状态</option>
              <option value="todo">待办</option>
              <option value="doing">进行中</option>
              <option value="done">完成</option>
            </select>
            <Button type="submit" variant="outline">
              筛选
            </Button>
          </form>

          {items.length ? (
            items.map((item) => (
              <AdminItemCard key={item.id} item={item} />
            ))
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="暂无行政事务"
              description="把组会、材料和报销先登记起来，首页会自动汇总近期事项。"
            />
          )}
        </div>
      </section>
    </div>
  );
}

function AdminItemCard({ item }: { item: AdminItem }) {
  return (
    <Card className="bg-white/95">
      <CardContent className="grid gap-3 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{item.title}</h2>
              <StatusBadge value={item.type} />
              <StatusBadge value={item.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(item.dueDate)} · 更新 {formatDateTime(item.updatedAt)}
            </p>
          </div>
          <form action={setAdminStatus} className="flex gap-2">
            <input type="hidden" name="id" value={item.id} />
            <select
              name="status"
              defaultValue={item.status}
              className="h-8 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="todo">待办</option>
              <option value="doing">进行中</option>
              <option value="done">完成</option>
            </select>
            <Button type="submit" variant="outline">
              更新
            </Button>
          </form>
        </div>

        {item.location ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {item.location}
          </p>
        ) : null}
        <TagList value={item.tags} />
        <p className="text-sm leading-6 text-muted-foreground">{item.notes ?? "暂无备注。"}</p>

        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">编辑事务</summary>
          <div className="mt-3">
            <AdminItemForm action={updateAdminItem} item={item} />
            <form action={deleteAdminItem} className="mt-3">
              <input type="hidden" name="id" value={item.id} />
              <Button type="submit" variant="destructive">
                <Trash2 className="size-4" />
                删除
              </Button>
            </form>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function AdminItemForm({
  action,
  item,
}: {
  action: (formData: FormData) => Promise<void>;
  item?: AdminItem;
}) {
  return (
    <form action={action} className="grid gap-3">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <Field label="事务标题">
        <Input name="title" required defaultValue={item?.title ?? ""} />
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="类型">
          <select
            name="type"
            defaultValue={item?.type ?? "meeting"}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="meeting">组会</option>
            <option value="material">材料</option>
            <option value="reimbursement">报销</option>
            <option value="deadline">截止</option>
          </select>
        </Field>
        <Field label="状态">
          <select
            name="status"
            defaultValue={item?.status ?? "todo"}
            className="h-8 rounded-lg border bg-background px-2 text-sm"
          >
            <option value="todo">待办</option>
            <option value="doing">进行中</option>
            <option value="done">完成</option>
          </select>
        </Field>
        <Field label="截止">
          <Input
            name="dueDate"
            type="date"
            defaultValue={item?.dueDate ? item.dueDate.toISOString().slice(0, 10) : ""}
          />
        </Field>
      </div>
      <Field label="地点 / 渠道">
        <Input name="location" defaultValue={item?.location ?? ""} />
      </Field>
      <Field label="标签">
        <Input name="tags" defaultValue={parseTags(item?.tags).join(", ")} />
      </Field>
      <Field label="备注">
        <Textarea name="notes" rows={4} defaultValue={item?.notes ?? ""} />
      </Field>
      <SubmitButton>{item ? "保存事务" : "创建事务"}</SubmitButton>
    </form>
  );
}
