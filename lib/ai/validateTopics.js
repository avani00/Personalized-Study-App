// Validates and normalizes the topic structure returned by the LLM.
// Enforces at most two levels: top-level topics (each with a summary) and a
// flat list of subtopics (each with a name and summary). Anything deeper is
// flattened. Throws if the structure is not recoverable.

class TopicsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TopicsValidationError";
  }
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSubtopic(raw) {
  // A bare string is treated as a name with no summary.
  if (typeof raw === "string") {
    const name = raw.trim();
    return name ? { name, summary: "" } : null;
  }
  if (raw && typeof raw === "object") {
    const name = asString(raw.name ?? raw.title ?? raw.topic);
    if (!name) return null;
    return {
      name,
      summary: asString(raw.summary ?? raw.description ?? raw.info),
    };
  }
  return null;
}

/**
 * @param {unknown} data
 * @returns {{
 *   subject: string,
 *   title: string,
 *   topics: { name: string, summary: string, subtopics: { name: string, summary: string }[] }[]
 * }}
 */
export function validateTopics(data) {
  if (!data || typeof data !== "object") {
    throw new TopicsValidationError("Response is not a JSON object.");
  }

  const topicsRaw = asArray(data.topics);
  if (topicsRaw.length === 0) {
    throw new TopicsValidationError("Response contains no topics.");
  }

  const topics = topicsRaw.map((topic, i) => {
    if (!topic || typeof topic !== "object") {
      throw new TopicsValidationError(`Topic at index ${i} is not an object.`);
    }
    const name = asString(topic.name ?? topic.topic);
    if (!name) {
      throw new TopicsValidationError(`Topic at index ${i} is missing a name.`);
    }
    const summary = asString(topic.summary ?? topic.description ?? topic.info);
    const subtopics = asArray(topic.subtopics)
      .map(normalizeSubtopic)
      .filter(Boolean);
    return { name, summary, subtopics };
  });

  return {
    subject: asString(data.subject) || "Unknown subject",
    title: asString(data.title) || "Untitled material",
    topics,
  };
}

export { TopicsValidationError };
