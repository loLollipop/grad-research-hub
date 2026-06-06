import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [
    papers,
    projects,
    milestones,
    tasks,
    experiments,
    notes,
    datasets,
    results,
    adminItems,
  ] = await Promise.all([
    prisma.paper.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.milestone.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.experiment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.note.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.dataset.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.result.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.adminItem.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      app: "grad-research-hub",
      version: 1,
      counts: {
        papers: papers.length,
        projects: projects.length,
        milestones: milestones.length,
        tasks: tasks.length,
        experiments: experiments.length,
        notes: notes.length,
        datasets: datasets.length,
        results: results.length,
        adminItems: adminItems.length,
      },
      data: {
        papers,
        projects,
        milestones,
        tasks,
        experiments,
        notes,
        datasets,
        results,
        adminItems,
      },
    },
    {
      headers: {
        "Content-Disposition": 'attachment; filename="grad-research-hub-export.json"',
      },
    },
  );
}
