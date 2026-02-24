import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/schema";
import { embedText, chunkText } from "@/lib/rag";
import { eq, desc } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rawText = "";

  if (file.name.toLowerCase().endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    rawText = parsed.text;
  } else {
    rawText = buffer.toString("utf-8");
  }

  const chunks = chunkText(rawText);

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "No text content found in file" },
      { status: 422 }
    );
  }

  const embeddedChunks: { embedding: number[]; content: string }[] = [];
  for (const chunk of chunks) {
    const embedding = await embedText(chunk);
    embeddedChunks.push({ embedding, content: chunk });
  }

  await db.insert(documents).values(
    embeddedChunks.map((c, i) => ({
      userId,
      filename: file.name,
      content: c.content,
      chunkIndex: i,
      embedding: c.embedding,
    }))
  );

  return NextResponse.json({ filename: file.name, chunks: chunks.length });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .selectDistinctOn([documents.filename], {
      filename: documents.filename,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(documents.filename, desc(documents.createdAt));

  const sorted = rows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({ docs: sorted });
}
