// Validates and normalizes the shallow topic structure returned by the LLM.
// Enforces at most two levels: top-level topics, each with a flat list of
// string subtopics (anything deeper is flattened to its name). Throws if the
// structure is not recoverable.

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
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") {
    // Flatten any nested object down to a single name — no deeper than one
    // level of subtopics is allowed.
    return asString(raw.name ?? raw.title ?? raw.topic);
  }
  return "";
}

/**
 * @param {unknown} data
 * @returns {{ subject: string, title: string, topics: { name: string, subtopics: string[] }[] }}
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
    const subtopics = asArray(topic.subtopics)
      .map(normalizeSubtopic)
      .filter(Boolean);
    return { name, subtopics };
  });

  return {
    subject: asString(data.subject) || "Unknown subject",
    title: asString(data.title) || "Untitled material",
    topics,
  };
}

export { TopicsValidationError };
