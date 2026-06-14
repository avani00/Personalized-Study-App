import {
  validateQuestions,
  QuestionsValidationError,
} from "./validateQuestions.js";

const DEFAULT_HOST = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2:3b";

// When the user picks "unlimited" (0), generate this many for now.
const DEFAULT_UNLIMITED_COUNT = 10;
// Hard cap to avoid runaway generations.
const MAX_COUNT = 50;

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 600;

class QuestionsError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "QuestionsError";
    this.status = status;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TYPE_INSTRUCTIONS = {
  multiple_choice:
    'Every question must be type "multiple_choice" with 4 options; the "answer" must exactly match one option.',
  short_answer:
    'Every question must be type "short_answer" with an empty options array and a concise expected "answer".',
  true_false:
    'Every question must be type "true_false" with options ["True","False"] and the "answer" being either "True" or "False".',
  mixed:
    "Vary the question type across multiple_choice, short_answer, and true_false. Follow each type's format.",
};

const SYSTEM_INSTRUCTION = [
  "You are a study quiz generator.",
  "Using ONLY the provided topic summaries, write quiz questions that test the",
  "selected topics.",
  "Spread the questions across the selected topics as evenly as possible.",
  "Do not use any outside knowledge or facts not present in the summaries.",
  "Return valid JSON only, matching the required schema. No markdown, no commentary.",
].join(" ");

const SCHEMA_DESCRIPTION = `Return JSON with exactly this shape:
{
  "questions": [
    {
      "type": "multiple_choice" | "short_answer" | "true_false",
      "topic": string,        // which selected topic this question covers
      "question": string,
      "options": string[],    // choices for multiple_choice / true_false; [] for short_answer
      "answer": string,       // the correct answer (must match an option for multiple_choice/true_false)
      "hint": string          // a short hint
    }
  ]
}`;

function buildContext(selection) {
  const lines = [
    `Subject: ${selection.subject || "Unknown"}`,
    `Title: ${selection.title || "Untitled"}`,
    "",
    "Selected topics and summaries:",
  ];
  for (const topic of selection.topics) {
    lines.push(`- ${topic.name}: ${topic.summary || "(no summary)"}`);
    for (const sub of topic.subtopics || []) {
      lines.push(`    * ${sub.name}: ${sub.summary || "(no summary)"}`);
    }
  }
  return lines.join("\n");
}

function buildPrompt(selection, count, type) {
  const typeRule = TYPE_INSTRUCTIONS[type] || TYPE_INSTRUCTIONS.mixed;
  return [
    SCHEMA_DESCRIPTION,
    "",
    `Generate exactly ${count} questions.`,
    typeRule,
    "Rules:",
    "- Base every question and answer ONLY on the summaries below.",
    "- Cover the selected topics; do not invent facts.",
    "- Keep questions clear and self-contained.",
    "",
    "STUDY CONTENT:",
    '"""',
    buildContext(selection),
    '"""',
  ].join("\n");
}

function stripCodeFences(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  return trimmed;
}

function resolveCount(numQuestions) {
  const n = Number.isFinite(numQuestions) ? Math.floor(numQuestions) : 0;
  if (n <= 0) return DEFAULT_UNLIMITED_COUNT;
  return Math.min(n, MAX_COUNT);
}

/**
 * Generate quiz questions from the selected topics using a local Ollama model.
 *
 * @param {{ selection: object, numQuestions: number, questionType: string }} input
 * @returns normalized array of questions
 * @throws {QuestionsError}
 */
export async function generateQuestions({ selection, numQuestions, questionType }) {
  if (!selection || typeof selection !== "object") {
    throw new QuestionsError("No topic selection was provided.", 400);
  }
  const topics = Array.isArray(selection.topics) ? selection.topics : [];
  if (topics.length === 0) {
    throw new QuestionsError("No topics were selected.", 400);
  }

  const count = resolveCount(numQuestions);
  const type = questionType || "multiple_choice";

  const host = (process.env.OLLAMA_HOST || DEFAULT_HOST).replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      let res;
      try {
        res = await fetch(`${host}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            system: SYSTEM_INSTRUCTION,
            prompt: buildPrompt(selection, count, type),
            stream: false,
            format: "json",
            options: { temperature: 0.4, num_ctx: 8192 },
          }),
        });
      } catch (err) {
        throw new QuestionsError(
          `Could not reach Ollama at ${host}. Make sure "ollama serve" is running. (${err.message})`,
          503
        );
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const message =
          res.status === 404
            ? `Ollama model "${model}" not found. Pull it first with: ollama pull ${model}`
            : `Ollama request failed (${res.status}): ${detail.slice(0, 300)}`;
        throw new QuestionsError(message, 502);
      }

      const data = await res.json();
      const outputText = data?.response;
      if (!outputText) {
        throw new QuestionsError("Ollama returned an empty response.", 502);
      }

      let parsed;
      try {
        parsed = JSON.parse(stripCodeFences(outputText));
      } catch {
        throw new QuestionsError("Ollama did not return valid JSON.", 502);
      }

      try {
        const questions = validateQuestions(parsed).slice(0, count);
        console.log(
          `[questions] generated ${questions.length} ${type} question(s) across ${topics.length} topic(s)`
        );
        return questions;
      } catch (err) {
        if (err instanceof QuestionsValidationError) {
          throw new QuestionsError(
            `Ollama output failed validation: ${err.message}`,
            502
          );
        }
        throw err;
      }
    } catch (err) {
      lastError = err;
      const isInputError = err instanceof QuestionsError && err.status === 400;
      const isUnreachable = err instanceof QuestionsError && err.status === 503;
      const retryable = !isInputError && !isUnreachable;

      if (attempt < MAX_ATTEMPTS && retryable) {
        await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
        continue;
      }
      break;
    }
  }

  if (lastError instanceof QuestionsError) {
    throw lastError;
  }
  throw new QuestionsError(
    `Question generation failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message || "unknown error"}`,
    502
  );
}

export { QuestionsError };
