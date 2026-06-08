// Validates and normalizes the JSON returned by the LLM so the frontend
// can rely on a consistent shape. Throws an Error if the structure is
// not recoverable.

class AnalysisValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AnalysisValidationError";
  }
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeKeyPoint(raw) {
  // Accept either a bare string or a { point, excerpt } object.
  if (typeof raw === "string") {
    return { point: raw.trim(), excerpt: "" };
  }
  if (raw && typeof raw === "object") {
    return {
      point: asString(raw.point ?? raw.text),
      excerpt: asString(raw.excerpt ?? raw.quote ?? raw.support),
    };
  }
  return null;
}

function normalizeDefinition(raw) {
  if (!raw || typeof raw !== "object") return null;
  const term = asString(raw.term);
  const definition = asString(raw.definition);
  if (!term || !definition) return null;
  return {
    term,
    definition,
    excerpt: asString(raw.excerpt ?? raw.quote ?? raw.support),
  };
}

function normalizeTopic(raw, index) {
  if (!raw || typeof raw !== "object") {
    throw new AnalysisValidationError(`Topic at index ${index} is not an object.`);
  }

  const name = asString(raw.name ?? raw.topic);
  if (!name) {
    throw new AnalysisValidationError(`Topic at index ${index} is missing a name.`);
  }

  const subtopics = asArray(raw.subtopics)
    .map(asString)
    .filter(Boolean);

  const key_points = asArray(raw.key_points)
    .map(normalizeKeyPoint)
    .filter((kp) => kp && kp.point);

  const definitions = asArray(raw.definitions)
    .map(normalizeDefinition)
    .filter(Boolean);

  return { name, subtopics, key_points, definitions };
}

/**
 * Validate and normalize the raw object parsed from the LLM response.
 * @param {unknown} data
 * @returns normalized analysis object
 */
export function validateStudyAnalysis(data) {
  if (!data || typeof data !== "object") {
    throw new AnalysisValidationError("Response is not a JSON object.");
  }

  const topicsRaw = asArray(data.topics);
  if (topicsRaw.length === 0) {
    throw new AnalysisValidationError("Response contains no topics.");
  }

  const topics = topicsRaw.map((t, i) => normalizeTopic(t, i));

  return {
    subject: asString(data.subject) || "Unknown subject",
    title: asString(data.title) || "Untitled material",
    topics,
  };
}

export { AnalysisValidationError };
