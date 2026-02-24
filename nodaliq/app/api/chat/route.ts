import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { embedText, searchSimilarChunks } from "@/lib/rag";

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const query: string | undefined = body.query;

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing required field: query" },
      { status: 422 }
    );
  }

  const queryEmbedding = await embedText(query);
  const chunks = await searchSimilarChunks(queryEmbedding, userId, 5);

  if (chunks.length === 0) {
    return NextResponse.json({
      answer:
        "I don't have any documents to reference. Please upload some files first.",
      sources: [],
    });
  }

  const contextText = chunks
    .map((c, i) => `[${i + 1}] (${c.filename})\n${c.content}`)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are an energy market intelligence assistant specializing in ERCOT LMP pricing and battery dispatch optimization. Answer questions using only the provided context. If the answer is not in the context, say so clearly. Be concise and precise.",
      },
      {
        role: "user",
        content: `Context:\n${contextText}\n\nQuestion: ${query}`,
      },
    ],
    temperature: 0.2,
  });

  const answer = completion.choices[0].message.content ?? "";

  return NextResponse.json({
    answer,
    sources: chunks.map((c) => ({
      filename: c.filename,
      content: c.content.slice(0, 200),
      similarity: c.similarity,
    })),
  });
}
