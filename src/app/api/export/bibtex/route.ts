import { prisma } from "@/lib/db";
import { papersToBibtex } from "@/lib/bibtex";

export const dynamic = "force-dynamic";

export async function GET() {
  const papers = await prisma.paper.findMany({ orderBy: { createdAt: "asc" } });
  const body = papersToBibtex(papers);

  return new Response(body, {
    headers: {
      "Content-Disposition": 'attachment; filename="grad-research-hub-papers.bib"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
