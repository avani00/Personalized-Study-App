"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { extractPdfText } from "@/lib/pdf/extractPdfText";

// Key used to persist the pasted study material across the flow.
// Later steps (and the eventual LLM call) read the content from here.
const STORAGE_KEY = "study:sourceContent";

// Auto-resizing textarea bounds (in lines).
const MIN_LINES = 2;
const MAX_LINES = 15;

export default function SourcePage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [extracting, setExtracting] = useState(false);

  // Grow the textarea to fit its content, between MIN_LINES and MAX_LINES.
  // Beyond MAX_LINES it stops growing and scrolls instead.
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const paddingY =
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const borderY =
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const minHeight = lineHeight * MIN_LINES + paddingY + borderY;
    const maxHeight = lineHeight * MAX_LINES + paddingY + borderY;

    el.style.height = "auto";
    // scrollHeight is content + padding; add border for border-box sizing.
    const fitHeight = el.scrollHeight + borderY;
    const next = Math.min(Math.max(fitHeight, minHeight), maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = fitHeight > maxHeight ? "auto" : "hidden";
  }, []);

  // Re-fit whenever the content changes (typing, file load).
  useEffect(() => {
    resizeTextarea();
  }, [content, resizeTextarea]);

  // Re-fit on viewport resize, since wrapping affects height.
  useEffect(() => {
    window.addEventListener("resize", resizeTextarea);
    return () => window.removeEventListener("resize", resizeTextarea);
  }, [resizeTextarea]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError("");
    const isPdf =
      file.type === "application/pdf" || /\.pdf$/i.test(file.name);

    try {
      let text;
      if (isPdf) {
        setExtracting(true);
        text = await extractPdfText(file);
        if (!text) {
          throw new Error(
            "No selectable text found (the PDF may be scanned images)."
          );
        }
      } else {
        // Plain-text files: use the content exactly as-is.
        text = await file.text();
      }
      setContent(text);
      setFileName(file.name);
    } catch (err) {
      setFileError(`Could not read that file. ${err.message}`);
      setFileName("");
    } finally {
      setExtracting(false);
    }
  };

  const clearFile = () => {
    setFileName("");
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
        <span className="field-label">Upload a file</span>
        <div className="file-row">
          <label className={`btn file-button${extracting ? " disabled" : ""}`}>
            {extracting ? "Extracting…" : "Choose file"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown,.csv,.json,.log,.text,text/*,.pdf,application/pdf"
              onChange={handleFile}
              disabled={extracting}
              hidden
            />
          </label>
          {fileName && !extracting && (
            <>
              <span className="file-name">{fileName}</span>
              <button type="button" className="btn link-btn" onClick={clearFile}>
                Clear
              </button>
            </>
          )}
        </div>
        {fileError ? (
          <p className="error-text field-hint">{fileError}</p>
        ) : extracting ? (
          <p className="muted field-hint">Extracting text from the PDF…</p>
        ) : (
          <p className="muted field-hint">
            Supports plain-text files (.txt, .md, etc.) and PDFs. Extracted text
            appears in the box below so you can review or edit it.
          </p>
        )}

        <label htmlFor="source-text" className="field-label field-label-spaced">
          Or paste text
        </label>
        <textarea
          id="source-text"
          ref={textareaRef}
          className="text-input autosize"
          placeholder="Paste notes, an article, lecture text, etc."
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            // Typing over file-loaded text: drop the stale filename label.
            if (fileName) setFileName("");
          }}
          rows={MIN_LINES}
        />
        <p className="muted field-hint">
          {charCount} character{charCount === 1 ? "" : "s"} saved
        </p>
      </div>

      <div className="actions">
        <Link href="/" className="btn">
          Cancel
        </Link>
        <button
          type="button"
          className="btn primary"
          onClick={handleContinue}
          disabled={charCount === 0 || extracting}
        >
          Preview content →
        </button>
      </div>
    </>
  );
}
