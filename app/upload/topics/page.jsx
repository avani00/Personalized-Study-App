"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const SOURCE_KEY = "study:sourceContent";
const ANALYSIS_KEY = "study:analysis";
// The exact text the cached analysis was generated from. Used to detect
// when the user has gone back and edited the source, so we re-analyze.
const ANALYZED_TEXT_KEY = "study:analyzedText";

export default function TopicsPage() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);

  const runAnalysis = useCallback(async () => {
    const text = (window.localStorage.getItem(SOURCE_KEY) || "").trim();
    if (!text) {
      setStatus("error");
      setError("No study material found. Go back and paste some text first.");
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
      setAnalysis(data.analysis);
      window.localStorage.setItem(ANALYSIS_KEY, JSON.stringify(data.analysis));
      // Remember which text this result came from so we can detect edits.
      window.localStorage.setItem(ANALYZED_TEXT_KEY, text);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    // Reuse a prior result only if the source text is unchanged since the
    // last analysis. If the user went back and edited the text, re-run.
    const currentText = (window.localStorage.getItem(SOURCE_KEY) || "").trim();
    const cached = window.localStorage.getItem(ANALYSIS_KEY);
    const analyzedText = window.localStorage.getItem(ANALYZED_TEXT_KEY);

    if (cached && analyzedText === currentText) {
      try {
        setAnalysis(JSON.parse(cached));
        setStatus("done");
        return;
      } catch {
        // fall through to re-analyze
      }
    }
    runAnalysis();
  }, [runAnalysis]);

  return (
    <>
      <div className="breadcrumb">
        <Link href="/">Home</Link> /{" "}
        <Link href="/upload/source">Upload new</Link> /{" "}
        <Link href="/upload/preview">Preview</Link> / Topics
      </div>

      <h1>Choose topics</h1>
      <p className="muted">Step 3 of 6 — Overarching topics from your material.</p>

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

          {analysis.topics.map((topic, i) => (
            <div key={i} className="panel">
              <h2 style={{ marginBottom: topic.subtopics.length ? 10 : 0 }}>
                {topic.name}
              </h2>

              {topic.subtopics.length > 0 && (
                <ul className="subtopic-list">
                  {topic.subtopics.map((sub, j) => (
                    <li key={j}>{sub}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      <div className="actions">
        <Link href="/upload/preview" className="btn">
          ← Back
        </Link>
        <Link
          href="/upload/settings"
          className={`btn primary${status === "done" ? "" : " disabled"}`}
          aria-disabled={status !== "done"}
        >
          Choose settings →
        </Link>
      </div>
    </>
  );
}
