import { validateTopics, TopicsValidationError } from "./validateTopics.js";

const DEFAULT_HOST = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2:3b";

// Minimum amount of meaningful text before it's worth calling the model.
export const MIN_CONTENT_LENGTH = 40;

// Retry transient failures (empty responses or malformed JSON that often
// succeed on a fresh generation). Connection failures are NOT retried.
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 600;

class TopicsError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "TopicsError";
    this.status = status;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SYSTEM_INSTRUCTION = [
  "You are a study-material topic organizer.",
  "Read the supplied study material and identify only the overarching,",
  "high-level topics it covers.",
  "Use only information explicitly supported by the text; do not add outside",
  "facts or invent topics.",
  "Allow at most ONE level of subtopics under each topic. Subtopics must be",
  "short labels, never nested any deeper.",
  "Example of the deepest allowed nesting: topic \"Probability\" with subtopic",
  '"Expected value".',
  "Keep topics broad and overarching, not fine-grained details.",
  "Return valid JSON only, matching the required schema. No markdown, no commentary.",
].join(" ");

const SCHEMA_DESCRIPTION = `Return JSON with exactly this shape:
{
  "subject": string,        // best-guess subject area, from the text only
  "title": string,          // a short title for the material
  "topics": [
    {
      "name": string,            // an overarching, high-level topic
      "subtopics": string[]      // at most one level; short labels only
    }
  ]
}`;

function buildPrompt(text) {
  return [
    SCHEMA_DESCRIPTION,
    "",
    "Rules:",
    "- Only list overarching topics actually covered by the text.",
    "- Each topic may have a single, flat list of subtopics (no deeper nesting).",
    "- Do not include explanations, key points, definitions, or quotes.",
    "- Never invent topics that are not supported by the text.",
    "",
    "STUDY MATERIAL:",
    '"""',
    text,
    '"""',
  ].join("\n");
}

// Strip ```json fences if the model wraps the output despite instructions.
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

/**
 * Extract a shallow topic outline from study text using a local Ollama model.
 *
 * @param {string} rawText - the user-supplied study material
 * @returns normalized { subject, title, topics: [{ name, subtopics }] }
 * @throws {TopicsError} on bad input, unreachable server, or invalid output
 */
export async function extractTopics(rawText) {
  const text = typeof rawText === "string" ? rawText.trim() : "";

  if (text.length === 0) {
    throw new TopicsError("No study text was provided.", 400);
  }
  if (text.length < MIN_CONTENT_LENGTH) {
    throw new TopicsError(
      `Study text is too short to analyze (need at least ${MIN_CONTENT_LENGTH} characters).`,
      400
    );
  }

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
            prompt: buildPrompt(text),
            stream: false,
            format: "json",
            options: { temperature: 0.2, num_ctx: 8192 },
          }),
        });
      } catch (err) {
        // Connection refused / DNS / network — Ollama likely isn't running.
        throw new TopicsError(
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
        throw new TopicsError(message, 502);
      }

      const data = await res.json();
      const outputText = data?.response;
      if (!outputText) {
        throw new TopicsError("Ollama returned an empty response.", 502);
      }

      let parsed;
      try {
        parsed = JSON.parse(stripCodeFences(outputText));
      } catch {
        throw new TopicsError("Ollama did not return valid JSON.", 502);
      }

      try {
        return validateTopics(parsed);
      } catch (err) {
        if (err instanceof TopicsValidationError) {
          throw new TopicsError(
            `Ollama output failed validation: ${err.message}`,
            502
          );
        }
        throw err;
      }
    } catch (err) {
      lastError = err;

      // Don't retry input errors (400) or an unreachable server (503) —
      // those won't fix themselves within a few attempts.
      const isInputError = err instanceof TopicsError && err.status === 400;
      const isUnreachable = err instanceof TopicsError && err.status === 503;
      const retryable = !isInputError && !isUnreachable;

      if (attempt < MAX_ATTEMPTS && retryable) {
        await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
        continue;
      }
      break;
    }
  }

  if (lastError instanceof TopicsError) {
    throw lastError;
  }
  throw new TopicsError(
    `Topic extraction failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message || "unknown error"}`,
    502
  );
}

export { TopicsError };
