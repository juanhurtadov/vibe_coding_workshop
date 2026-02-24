import OpenAI from "openai";
import { db } from "./db";
import { documents } from "./schema";
import { eq, sql } from "drizzle-orm";

export async function embedText(text: string): Promise<number[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const trimmed = text.slice(0, 8000);
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: trimmed,
  });
  return response.data[0].embedding;
}

export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 50
): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  const step = chunkSize - overlap;

  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.length >= 20) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

export async function searchSimilarChunks(
  queryEmbedding: number[],
  userId: string,
  limit = 5
): Promise<{ content: string; filename: string; similarity: number }[]> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const results = await db
    .select({
      content: documents.content,
      filename: documents.filename,
      similarity: sql<number>`1 - (embedding <=> ${vectorStr}::vector)`,
    })
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(sql`embedding <=> ${vectorStr}::vector`)
    .limit(limit);

  return results;
}
