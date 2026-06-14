"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SETTINGS_KEY = "study:settings";

const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "short_answer", label: "Short answer" },
  { value: "true_false", label: "True / False" },
  { value: "mixed", label: "Mixed" },
];

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "adaptive", label: "Adaptive (adjusts as you go)" },
];

const DEFAULT_SETTINGS = {
  numQuestions: 10,
  questionType: "multiple_choice",
  difficulty: "medium",
};

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Restore previously chosen settings when returning to this step.
  useEffect(() => {
    const saved = window.localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch {
        // ignore malformed saved settings
      }
    }
  }, []);

  const update = (patch) => setSettings((prev) => ({ ...prev, ...patch }));

  const handleNumChange = (e) => {
    const raw = parseInt(e.target.value, 10);
    update({ numQuestions: Number.isNaN(raw) ? 0 : Math.max(0, raw) });
  };

  const handleContinue = () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    router.push("/upload/questions");
  };

  return (
    <>
      <div className="breadcrumb">
        <Link href="/">Home</Link> /{" "}
        <Link href="/upload/source">Upload new</Link> /{" "}
        <Link href="/upload/topics">Topics</Link> / Settings
      </div>

      <h1>Choose settings</h1>
      <p className="muted">Step 4 of 6 — Configure how questions are generated.</p>

      <div className="panel">
        <label htmlFor="num-questions" className="field-label">
          Number of questions
        </label>
        <input
          id="num-questions"
          type="number"
          min={0}
          className="number-input"
          value={settings.numQuestions}
          onChange={handleNumChange}
        />
        <p className="muted field-hint">Set to 0 for unlimited questions.</p>
      </div>

      <div className="panel">
        <span className="field-label">Question type</span>
        <div className="option-group">
          {QUESTION_TYPES.map((opt) => (
            <label key={opt.value} className="check-row">
              <input
                type="radio"
                name="question-type"
                value={opt.value}
                checked={settings.questionType === opt.value}
                onChange={() => update({ questionType: opt.value })}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="panel">
        <span className="field-label">Difficulty</span>
        <div className="option-group">
          {DIFFICULTIES.map((opt) => (
            <label key={opt.value} className="check-row">
              <input
                type="radio"
                name="difficulty"
                value={opt.value}
                checked={settings.difficulty === opt.value}
                onChange={() => update({ difficulty: opt.value })}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="actions">
        <Link href="/upload/topics" className="btn">
          ← Back
        </Link>
        <button type="button" className="btn primary" onClick={handleContinue}>
          Start questions →
        </button>
      </div>
    </>
  );
}
