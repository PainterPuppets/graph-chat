import mammoth from "mammoth";

export const runtime = "nodejs";

import { addGraphDataBatch, chunkText, ensureGraph, ensureUser, ensureWorldOntology } from "@/lib/zep";

export async function POST(req: Request) {
  if (!process.env.ZEP_API_KEY) {
    return Response.json({ error: "ZEP_API_KEY is not configured" }, { status: 500 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files");
  const legacyFile = formData.get("file");
  const userId = (formData.get("userId") as string) ?? process.env.ZEP_USER_ID ?? "demo-user";
  const graphId = (formData.get("graphId") as string) ?? process.env.ZEP_GRAPH_ID;
  const chunkSize = Number(formData.get("chunkSize")) || 8000;

  const uploadedFiles = files.filter((entry): entry is File => entry instanceof File);
  if (legacyFile instanceof File) {
    uploadedFiles.push(legacyFile);
  }
  if (uploadedFiles.length === 0) {
    return Response.json({ error: "Missing file upload" }, { status: 400 });
  }

  const createdAt = new Date().toISOString();
  let totalEpisodes = 0;

  try {
    await ensureUser(userId);
    await ensureGraph(graphId);
    await ensureWorldOntology({ userId, graphId });

    const allEpisodes: { data: string; type: "text"; sourceDescription?: string; createdAt?: string }[] = [];
    for (const file of uploadedFiles) {
      const rawText = await extractText(file);
      if (!rawText.trim()) continue;
      const chunks = chunkText(rawText, chunkSize);
      chunks.forEach((chunk, index) => {
        allEpisodes.push({
          data: chunk,
          type: "text",
          sourceDescription: `${file.name} (chunk ${index + 1}/${chunks.length})`,
          createdAt,
        });
      });
    }

    if (!allEpisodes.length) {
      return Response.json({ error: "No valid text extracted from files" }, { status: 400 });
    }

    await addGraphDataBatch({
      userId,
      graphId,
      episodes: allEpisodes,
    });
    totalEpisodes = allEpisodes.length;
  } catch (error) {
    console.error("Zep ingestion failed:", error);
    return Response.json({ error: "Failed to ingest document" }, { status: 500 });
  }

  return Response.json({
    ok: true,
    files: uploadedFiles.length,
    chunks: totalEpisodes,
  });
}

async function extractText(file: File) {
  if (file.name.toLowerCase().endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
    return result.value ?? "";
  }
  return file.text();
}
