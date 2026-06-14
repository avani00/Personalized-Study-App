"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SOURCE_KEY = "study:sourceContent";
const ANALYSIS_KEY = "study:analysis";
// The exact text the cached analysis was generated from. Used to detect
// when the user has gone back and edited the source, so we re-analyze.
const ANALYZED_TEXT_KEY = "study:analyzedText";
// The selected subset (with summaries) used by later steps.
const SELECTION_KEY = "study:selection";

// Build the id used to track a subtopic's checkbox.
const subId = (t, s) => `${t}.${s}`;
// Childless topics are selectable directly.
const topicId = (t) => `t${t}`;

export default function TopicsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  // Select everything by default once an analysis is available.
  const selectAll = useCallback((data) => {
    const next = new Set();
    data.topics.forEach((topic, t) => {
      if (topic.subtopics.length > 0) {
        topic.subtopics.forEach((_, s) => next.add(subId(t, s)));
      } else {
        next.add(topicId(t));
      }
    });
    setSelected(next);
  }, []);

  const applyAnalysis = useCallback(
    (data) => {
      setAnalysis(data);
      selectAll(data);
      setStatus("done");
    },
    [selectAll]
  );

  const runAnalysis = useCallback(async () => {
    const text = (window.localStorage.getItem(SOURCE_KEY) || "").trim();
    if (!text) {
      setStatus("error");
      setError("No study material found. Go back and upload a PDF first.");
      return;
    }

    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Analysis failed.");
      }
      window.localStorage.setItem(ANALYSIS_KEY, JSON.stringify(data.analysis));
      window.localStorage.setItem(ANALYZED_TEXT_KEY, text);
      applyAnalysis(data.analysis);
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }, [applyAnalysis]);

  useEffect(() => {
    // Reuse a prior result only if the source text is unchanged since the
    // last analysis. If the user went back and edited the text, re-run.
    const currentText = (window.localStorage.getItem(SOURCE_KEY) || "").trim();
    const cached = window.localStorage.getItem(ANALYSIS_KEY);
    const analyzedText = window.localStorage.getItem(ANALYZED_TEXT_KEY);

    if (cached && analyzedText === currentText) {
      try {
        applyAnalysis(JSON.parse(cached));
        return;
      } catch {
        // fall through to re-analyze
      }
    }
    runAnalysis();
  }, [applyAnalysis, runAnalysis]);

  const toggleSub = (t, s) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const id = subId(t, s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTopic = (t, topic) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (topic.subtopics.length > 0) {
        const allOn = topic.subtopics.every((_, s) => next.has(subId(t, s)));
        topic.subtopics.forEach((_, s) => {
          if (allOn) next.delete(subId(t, s));
          else next.add(subId(t, s));
        });
      } else {
        const id = topicId(t);
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  // Derive the selected subset (with summaries) to persist for later steps.
  const selection = useMemo(() => {
    if (!analysis) return { subject: "", title: "", topics: [] };
    const topics = analysis.topics
      .map((topic, t) => {
        const hasSubs = topic.subtopics.length > 0;
        const subtopics = topic.subtopics.filter((_, s) =>
          selected.has(subId(t, s))
        );
        const included = hasSubs ? subtopics.length > 0 : selected.has(topicId(t));
        if (!included) return null;
        return { name: topic.name, summary: topic.summary, subtopics };
      })
      .filter(Boolean);
    return { subject: analysis.subject, title: analysis.title, topics };
  }, [analysis, selected]);

  const selectedCount = selection.topics.length;

  const handleContinue = () => {
    window.localStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
    router.push("/upload/settings");
  };

  return (
    <>
      <div className="breadcrumb">
        <Link href="/">Home</Link> /{" "}
        <Link href="/upload/source">Upload new</Link> /{" "}
        <Link href="/upload/preview">Preview</Link> / Topics
      </div>

      <h1>Choose topics</h1>
      <p className="muted">
        Step 3 of 6 — Select the topics and subtopics you want to study.
      </p>

      {status === "loading" && (
        <div className="panel">
          <p className="muted">Finding topics with Ollama…</p>
        </div>
      )}

      {status === "error" && (
        <div className="panel">
          <p className="error-text">{error}</p>
          <div className="actions">
            <button type="button" className="btn" onClick={runAnalysis}>
              Try again
            </button>
          </div>
        </div>
      )}

      {status === "done" && analysis && (
        <>
          <div className="panel">
            <p className="muted" style={{ margin: 0 }}>
              {analysis.subject}
            </p>
            <h2 style={{ margin: "4px 0 0" }}>{analysis.title}</h2>
          </div>

          {analysis.topics.map((topic, t) => {
            const hasSubs = topic.subtopics.length > 0;
            const allOn = hasSubs
              ? topic.subtopics.every((_, s) => selected.has(subId(t, s)))
              : selected.has(topicId(t));
            const someOn =
              hasSubs && topic.subtopics.some((_, s) => selected.has(subId(t, s)));

            return (
              <div key={t} className="panel">
                <label className="check-row check-topic">
                  <input
                    type="checkbox"
                    checked={allOn}
                    ref={(el) => {
                      if (el) el.indeterminate = !allOn && someOn;
                    }}
                    onChange={() => toggleTopic(t, topic)}
                  />
                  <span>{topic.name}</span>
                </label>

                {hasSubs && (
                  <div className="subtopic-checks">
                    {topic.subtopics.map((sub, s) => (
                      <label key={s} className="check-row">
                        <input
                          type="checkbox"
                          checked={selected.has(subId(t, s))}
                          onChange={() => toggleSub(t, s)}
                        />
                        <span>{sub.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      <div className="actions">
        <Link href="/upload/preview" className="btn">
          ← Back
        </Link>
        <button
          type="button"
          className="btn primary"
          onClick={handleContinue}
          disabled={status !== "done" || selectedCount === 0}
        >
          Choose settings →
        </button>
      </div>
    </>
  );
}
