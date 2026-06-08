"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Key used to persist the pasted study material across the flow.
// Later steps (and the eventual LLM call) read the content from here.
const STORAGE_KEY = "study:sourceContent";

export default function SourcePage() {
  const router = useRouter();
  const [content, setContent] = useState("");

  // Restore any previously pasted content when returning to this step.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setContent(saved);
  }, []);

  const handleContinue = () => {
    // sourceContent is the variable that will later be fed into the LLM.
    const sourceContent = content.trim();
    window.localStorage.setItem(STORAGE_KEY, sourceContent);
    router.push("/upload/preview");
  };

  const charCount = content.trim().length;

  return (
    <>
      <div className="breadcrumb">
        <Link href="/">Home</Link> / Upload new
      </div>

      <h1>Paste text / upload file</h1>
      <p className="muted">Step 1 of 6 — Add the material you want to study.</p>

      <div className="panel">
        <label htmlFor="source-text" className="field-label">
          Paste your study material
        </label>
        <textarea
          id="source-text"
          className="text-input"
          placeholder="Paste notes, an article, lecture text, etc."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
        />
        <p className="muted field-hint">
          {charCount} character{charCount === 1 ? "" : "s"} saved
        </p>
      </div>

      <div className="placeholder">
        [ File upload dropzone placeholder — PDF, slides, txt ]
      </div>

      <div className="actions">
        <Link href="/" className="btn">
          Cancel
        </Link>
        <button
          type="button"
          className="btn primary"
          onClick={handleContinue}
          disabled={charCount === 0}
        >
          Preview content →
        </button>
      </div>
    </>
  );
}
