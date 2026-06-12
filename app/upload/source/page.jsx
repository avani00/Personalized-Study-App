"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { extractPdfText } from "@/lib/pdf/extractPdfText";

// Key used to persist the extracted study material across the flow.
// Later steps (and the eventual LLM call) read the content from here.
const STORAGE_KEY = "study:sourceContent";

export default function SourcePage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  // Each entry: { id, name, text }
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const processFiles = async (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    setFileError("");
    const errors = [];
    const pdfs = [];
    for (const file of incoming) {
      const isPdf =
        file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (isPdf) pdfs.push(file);
      else errors.push(`${file.name} is not a PDF`);
    }

    if (pdfs.length > 0) {
      setExtracting(true);
      const extracted = [];
      for (const file of pdfs) {
        try {
          const text = await extractPdfText(file);
          if (!text) {
            errors.push(`${file.name}: no selectable text`);
            continue;
          }
          extracted.push({ id: crypto.randomUUID(), name: file.name, text });
        } catch (err) {
          errors.push(`${file.name}: ${err.message}`);
        }
      }
      if (extracted.length > 0) {
        // Append, skipping any file whose name is already in the list.
        setFiles((prev) => {
          const existing = new Set(prev.map((f) => f.name));
          return [...prev, ...extracted.filter((f) => !existing.has(f.name))];
        });
      }
      setExtracting(false);
    }

    if (errors.length > 0) setFileError(errors.join(" · "));
    // Reset so re-selecting the same file still fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openPicker = () => {
    if (!extracting) fileInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!extracting) setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (extracting) return;
    processFiles(e.dataTransfer.files);
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleContinue = () => {
    // sourceContent is the combined text fed into the LLM later.
    window.localStorage.setItem(STORAGE_KEY, combinedContent);
    router.push("/upload/preview");
  };

  const combinedContent = files
    .map((f) => f.text)
    .join("\n\n")
    .trim();
  const charCount = combinedContent.length;

  return (
    <>
      <div className="breadcrumb">
        <Link href="/">Home</Link> / Upload new
      </div>

      <h1>Upload PDFs</h1>
      <p className="muted">Step 1 of 6 — Add the PDFs you want to study.</p>

      <div className="panel">
        <span className="field-label">Choose PDF files</span>

        <div
          className={`dropzone${dragging ? " dragging" : ""}${
            extracting ? " disabled" : ""
          }`}
          onClick={openPicker}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={(e) => processFiles(e.target.files)}
            disabled={extracting}
            hidden
          />
          <p className="dropzone-text">
            {extracting ? "Extracting…" : "Drop PDFs here or click to upload"}
          </p>
          <button
            type="button"
            className="btn"
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
            disabled={extracting}
          >
            Choose Files
          </button>
        </div>

        {files.length > 0 && (
          <div className="file-list">
            {files.map((f) => (
              <div key={f.id} className="file-item">
                <span className="file-name">{f.name}</span>
                <span className="muted file-meta">
                  {f.text.trim().length.toLocaleString()} chars
                </span>
                <button
                  type="button"
                  className="btn link-btn"
                  onClick={() => removeFile(f.id)}
                  disabled={extracting}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn link-btn"
              onClick={clearAll}
              disabled={extracting}
            >
              Clear all
            </button>
          </div>
        )}

        {fileError ? (
          <p className="error-text field-hint">{fileError}</p>
        ) : extracting ? (
          <p className="muted field-hint">Extracting text from the PDF(s)…</p>
        ) : files.length > 0 ? (
          <p className="muted field-hint">
            {charCount.toLocaleString()} characters from {files.length} file
            {files.length === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="muted field-hint">
            Only PDFs are accepted. You can add several. Scanned/image-only PDFs
            won’t have extractable text.
          </p>
        )}
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
