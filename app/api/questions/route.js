import { NextResponse } from "next/server";
import { generateQuestions, QuestionsError } from "@/lib/ai/generateQuestions";

// Run on the Node.js runtime so fetch to the local Ollama server works.
export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const questions = await generateQuestions({
      selection: body?.selection,
      numQuestions: Number(body?.numQuestions),
      questionType: body?.questionType,
    });
    return NextResponse.json({ questions });
  } catch (err) {
    if (err instanceof QuestionsError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Unexpected error in /api/questions:", err);
    return NextResponse.json(
      { error: "Unexpected server error while generating questions." },
      { status: 500 }
    );
  }
}
