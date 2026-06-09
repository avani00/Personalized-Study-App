import { GoogleGenAI } from "@google/genai";
import { validateStudyAnalysis, AnalysisValidationError } from "./validateAnalysis.js";

const DEFAULT_MODEL = "gemini-2.5-flash";

// Temporary switch: when false, skip Gemini entirely and just echo the
// supplied input back (first line as the title, full text shown). Useful for
// testing the upload/text pipeline without spending API calls.
// Flip to true to re-enable the real Gemini analysis.
const USE_GEMINI = false;

// Minimum amount of meaningful text before it's worth calling the model.
export const MIN_CONTENT_LENGTH = 40;

// Build a stub analysis from the raw input without calling any LLM.
function buildRawPreview(text) {
  const firstLine =
    text.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ||
    text.slice(0, 80);

  return {
    subject: "Gemini disabled — raw input preview",
    title: firstLine,
    topics: [
      {
        name: "Input preview",
        subtopics: [],
        key_points: [{ point: text, excerpt: firstLine }],
        definitions: [],
      },
    ],
  };
}

// Retry behavior for transient failures (overloaded model, rate limits,
// empty responses, or malformed JSON that often succeeds on a retry).
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 700;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Transient/server-side conditions worth retrying.
function isTransientMessage(message = "") {
  return /\b(429|500|502|503|504|UNAVAILABLE|INTERNAL|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|overloaded|high demand|try again)\b/i.test(
    message
  );
}

class AnalyzeError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "AnalyzeError";
    this.status = status;
  }
}

const SYSTEM_INSTRUCTION = [
  "You are a study-material analyzer.",
  "Analyze the supplied study material.",
  "Extract only information that is explicitly supported by the text.",
  "Do not add outside facts, assumptions, or knowledge not present in the text.",
  "Organize the material into topics, subtopics, key points, and definitions.",
  "For every key point and every definition, include a short supporting excerpt",
  "copied verbatim from the supplied text.",
  "Return valid JSON only, matching the required schema. No markdown, no commentary.",
].join(" ");

const SCHEMA_DESCRIPTION = `Return JSON with exactly this shape:
{
  "subject": string,            // best-guess subject area, from the text only
  "title": string,              // a short title for the material
  "topics": [
    {
      "name": string,
      "subtopics": string[],
      "key_points": [
        { "point": string, "excerpt": string }   // excerpt = verbatim quote from the text
      ],
      "definitions": [
        { "term": string, "definition": string, "excerpt": string }
      ]
    }
  ]
}`;

function buildPrompt(text) {
  return [
    SCHEMA_DESCRIPTION,
    "",
    "Rules:",
    "- Use only the supplied text; never invent facts.",
    "- Every excerpt must be a substring quoted directly from the supplied text.",
    "- If something is not in the text, omit it.",
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
 * Analyze raw study text with Gemini and return a normalized, validated
 * structure of topics/subtopics/key points/definitions.
 *
 * @param {string} rawText - the user-supplied study material
 * @returns normalized analysis object
 * @throws {AnalyzeError} on bad input, missing config, API failure, or invalid output
 */
export async function analyzeStudyText(rawText) {
  const text = typeof rawText === "string" ? rawText.trim() : "";

  if (text.length === 0) {
    throw new AnalyzeError("No study text was provided.", 400);
  }

  // Temporary: skip the model and just return the raw input.
  if (!USE_GEMINI) {
    return buildRawPreview(text);
  }

  if (text.length < MIN_CONTENT_LENGTH) {
    throw new AnalyzeError(
      `Study text is too short to analyze (need at least ${MIN_CONTENT_LENGTH} characters).`,
      400
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AnalyzeError(
      "GEMINI_API_KEY is not configured on the server.",
      500
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: buildPrompt(text),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const outputText = response?.text;
      if (!outputText) {
        throw new AnalyzeError("Gemini returned an empty response.", 502);
      }

      let parsed;
      try {
        parsed = JSON.parse(stripCodeFences(outputText));
      } catch {
        throw new AnalyzeError("Gemini did not return valid JSON.", 502);
      }

      try {
        return validateStudyAnalysis(parsed);
      } catch (err) {
        if (err instanceof AnalysisValidationError) {
          throw new AnalyzeError(
            `Gemini output failed validation: ${err.message}`,
            502
          );
        }
        throw err;
      }
    } catch (err) {
      lastError = err;

      // Don't retry hard input errors (e.g. 400s) raised above.
      const isInputError = err instanceof AnalyzeError && err.status === 400;
      // Retry transient API failures, empty responses, and malformed JSON /
      // validation issues, which often resolve on a fresh generation.
      const retryable =
        !isInputError &&
        (isTransientMessage(err?.message) ||
          err instanceof AnalysisValidationError ||
          (err instanceof AnalyzeError && err.status === 502) ||
          !(err instanceof AnalyzeError));

      if (attempt < MAX_ATTEMPTS && retryable) {
        // Exponential backoff: ~0.7s, ~1.4s, ...
        await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
        continue;
      }
      break;
    }
  }

  if (lastError instanceof AnalyzeError) {
    throw lastError;
  }
  throw new AnalyzeError(
    `Gemini request failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message || "unknown error"}`,
    502
  );
}

export { AnalyzeError };
