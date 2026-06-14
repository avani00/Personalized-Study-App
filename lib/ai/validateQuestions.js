// Validates and normalizes the quiz questions returned by the LLM.

class QuestionsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "QuestionsValidationError";
  }
}

const VALID_TYPES = ["multiple_choice", "short_answer", "true_false"];

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeType(raw) {
  const t = asString(raw).toLowerCase().replace(/[\s-]+/g, "_");
  if (t === "mc" || t === "multiplechoice") return "multiple_choice";
  if (t === "tf" || t === "truefalse") return "true_false";
  if (t === "short" || t === "shortanswer") return "short_answer";
  return VALID_TYPES.includes(t) ? t : "";
}

function normalizeQuestion(raw) {
  if (!raw || typeof raw !== "object") return null;

  const question = asString(raw.question ?? raw.prompt ?? raw.text);
  const answer = asString(raw.answer ?? raw.correct ?? raw.correct_answer);
  if (!question || !answer) return null;

  let options = asArray(raw.options ?? raw.choices)
    .map(asString)
    .filter(Boolean);

  let type = normalizeType(raw.type);
  if (!type) {
    // Infer a type when the model omits or mislabels it.
    if (/^(true|false)$/i.test(answer) && options.length <= 2) {
      type = "true_false";
    } else if (options.length > 0) {
      type = "multiple_choice";
    } else {
      type = "short_answer";
    }
  }

  if (type === "true_false") {
    options = ["True", "False"];
  }
  if (type === "short_answer") {
    options = [];
  }

  return {
    type,
    topic: asString(raw.topic),
    question,
    options,
    answer,
    hint: asString(raw.hint),
  };
}

/**
 * @param {unknown} data
 * @returns {{ type: string, topic: string, question: string, options: string[], answer: string, hint: string }[]}
 */
export function validateQuestions(data) {
  const raw =
    data && typeof data === "object" && !Array.isArray(data)
      ? data.questions
      : data;
  const list = asArray(raw)
    .map(normalizeQuestion)
    .filter(Boolean);

  if (list.length === 0) {
    throw new QuestionsValidationError("No valid questions were returned.");
  }
  return list;
}

export { QuestionsValidationError };
