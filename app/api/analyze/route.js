import { NextResponse } from "next/server";
import { analyzeStudyText, AnalyzeError } from "@/lib/ai/analyzeStudyText";

// Run on the Node.js runtime so the Gemini SDK and process.env work as expected.
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
    const analysis = await analyzeStudyText(text);
    return NextResponse.json({ analysis });
  } catch (err) {
    if (err instanceof AnalyzeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Unexpected error in /api/analyze:", err);
    return NextResponse.json(
      { error: "Unexpected server error while analyzing text." },
      { status: 500 }
    );
  }
}
