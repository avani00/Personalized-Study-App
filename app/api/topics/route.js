import { NextResponse } from "next/server";
import { extractTopics, TopicsError } from "@/lib/ai/extractTopics";

// Run on the Node.js runtime so fetch to the local Ollama server works.
export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = typeof body?.text === "string" ? body.text : "";

  try {
    const analysis = await extractTopics(text);
    return NextResponse.json({ analysis });
  } catch (err) {
    if (err instanceof TopicsError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Unexpected error in /api/topics:", err);
    return NextResponse.json(
      { error: "Unexpected server error while extracting topics." },
      { status: 500 }
    );
  }
}
