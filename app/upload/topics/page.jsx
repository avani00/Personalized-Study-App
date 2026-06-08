"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const SOURCE_KEY = "study:sourceContent";
const ANALYSIS_KEY = "study:analysis";

export default function TopicsPage() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);

  const runAnalysis = useCallback(async () => {
    const text = window.localStorage.getItem(SOURCE_KEY) || "";
    if (!text.trim()) {
      setStatus("error");
      setError("No study material found. Go back and paste some text first.");
      return;
    }

    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/analyze", {
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
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    // Reuse a prior result if present; otherwise analyze on first load.
    const cached = window.localStorage.getItem(ANALYSIS_KEY);
    if (cached) {
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
      <p className="muted">Step 3 of 6 — Topics extracted from your material.</p>

      {status === "loading" && (
        <div className="panel">
          <p className="muted">Analyzing your material with Gemini…</p>
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
              <h2>{topic.name}</h2>

              {topic.subtopics.length > 0 && (
                <p className="muted" style={{ marginTop: 0 }}>
                  {topic.subtopics.join(" · ")}
                </p>
              )}

              {topic.key_points.length > 0 && (
                <>
                  <h3 className="section-label">Key points</h3>
                  <ul className="point-list">
                    {topic.key_points.map((kp, j) => (
                      <li key={j}>
                        <span>{kp.point}</span>
                        {kp.excerpt && (
                          <blockquote className="excerpt">“{kp.excerpt}”</blockquote>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {topic.definitions.length > 0 && (
                <>
                  <h3 className="section-label">Definitions</h3>
                  <ul className="point-list">
                    {topic.definitions.map((def, j) => (
                      <li key={j}>
                        <span>
                          <strong>{def.term}:</strong> {def.definition}
                        </span>
                        {def.excerpt && (
                          <blockquote className="excerpt">“{def.excerpt}”</blockquote>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
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
