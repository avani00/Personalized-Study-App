"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const SELECTION_KEY = "study:selection";
const SETTINGS_KEY = "study:settings";
const QUESTIONS_KEY = "study:questions";

function readJSON(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// A signature of the inputs, so we only regenerate when they change.
function buildSignature(selection, settings) {
  return JSON.stringify({
    topics: (selection?.topics || []).map((t) => ({
      name: t.name,
      subs: (t.subtopics || []).map((s) => s.name),
    })),
    numQuestions: settings?.numQuestions ?? null,
    questionType: settings?.questionType ?? null,
  });
}

export default function QuestionsPage() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);

  // Transient per-question UI state.
  const [choice, setChoice] = useState("");
  const [typed, setTyped] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const generate = useCallback(async () => {
    const selection = readJSON(SELECTION_KEY);
    const settings = readJSON(SETTINGS_KEY);

    if (!selection || !(selection.topics || []).length) {
      setStatus("error");
      setError("No topics selected. Go back and choose topics first.");
      return;
    }

    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selection,
          numQuestions: settings?.numQuestions ?? 10,
          questionType: settings?.questionType ?? "multiple_choice",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Question generation failed.");
      }
      setQuestions(data.questions);
      setIndex(0);
      window.localStorage.setItem(
        QUESTIONS_KEY,
        JSON.stringify({
          signature: buildSignature(selection, settings),
          questions: data.questions,
        })
      );
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const selection = readJSON(SELECTION_KEY);
    const settings = readJSON(SETTINGS_KEY);
    const cached = readJSON(QUESTIONS_KEY);
    const signature = buildSignature(selection, settings);

    if (cached && cached.signature === signature && cached.questions?.length) {
      setQuestions(cached.questions);
      setStatus("done");
      return;
    }
    generate();
  }, [generate]);

  // Reset per-question UI when moving between questions.
  useEffect(() => {
    setChoice("");
    setTyped("");
    setShowHint(false);
    setShowAnswer(false);
  }, [index]);

  const current = questions[index];
  const isLast = index === questions.length - 1;

  const goNext = () => {
    if (!isLast) setIndex((i) => i + 1);
  };
  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  return (
    <>
      <div className="breadcrumb">
        <Link href="/">Home</Link> /{" "}
        <Link href="/upload/source">Upload new</Link> /{" "}
        <Link href="/upload/topics">Topics</Link> /{" "}
        <Link href="/upload/settings">Settings</Link> / Questions
      </div>

      <h1>Questions</h1>

      {status === "loading" && (
        <div className="panel">
          <p className="muted">Generating questions with Ollama…</p>
        </div>
      )}

      {status === "error" && (
        <div className="panel">
          <p className="error-text">{error}</p>
          <div className="actions">
            <button type="button" className="btn" onClick={generate}>
              Try again
            </button>
            <Link href="/upload/settings" className="btn">
              ← Settings
            </Link>
          </div>
        </div>
      )}

      {status === "done" && current && (
        <>
          <p className="muted">
            Question {index + 1} of {questions.length}
            {current.topic ? ` · ${current.topic}` : ""}
          </p>

          <div className="panel">
            <h2 className="question-text">{current.question}</h2>

            {current.options.length > 0 ? (
              <div className="option-group">
                {current.options.map((opt, i) => {
                  const isAnswer = showAnswer && opt === current.answer;
                  const isWrongChoice =
                    showAnswer && choice === opt && opt !== current.answer;
                  return (
                    <label
                      key={i}
                      className={`check-row option-row${
                        isAnswer ? " option-correct" : ""
                      }${isWrongChoice ? " option-wrong" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`q-${index}`}
                        value={opt}
                        checked={choice === opt}
                        onChange={() => setChoice(opt)}
                        disabled={showAnswer}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                className="number-input answer-input"
                placeholder="Type your answer…"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={showAnswer}
              />
            )}

            {showHint && current.hint && (
              <p className="muted hint-text">Hint: {current.hint}</p>
            )}

            {showAnswer && (
              <p className="answer-reveal">
                Answer: <strong>{current.answer}</strong>
              </p>
            )}
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn"
              onClick={() => setShowHint(true)}
              disabled={!current.hint || showHint}
            >
              Hint
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setShowAnswer(true)}
              disabled={showAnswer}
            >
              Submit
            </button>
            <button type="button" className="btn" onClick={goPrev} disabled={index === 0}>
              ← Previous
            </button>
            {isLast ? (
              <Link href="/upload/results" className="btn primary">
                Finish → Results
              </Link>
            ) : (
              <button type="button" className="btn primary" onClick={goNext}>
                {showAnswer ? "Next →" : "Skip →"}
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
