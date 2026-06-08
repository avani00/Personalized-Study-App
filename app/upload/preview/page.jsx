"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "study:sourceContent";

export default function PreviewPage() {
  const [content, setContent] = useState(null);

  useEffect(() => {
    setContent(window.localStorage.getItem(STORAGE_KEY) || "");
  }, []);

  return (
    <>
      <div className="breadcrumb">
        <Link href="/">Home</Link> / <Link href="/upload/source">Upload new</Link> / Preview
      </div>

      <h1>Preview content</h1>
      <p className="muted">Step 2 of 6 — Confirm the saved content looks right.</p>

      <div className="panel">
        {content === null ? (
          <p className="muted">Loading…</p>
        ) : content.length === 0 ? (
          <p className="muted">
            No content saved yet. Go back and paste your study material.
          </p>
        ) : (
          <div className="content-preview">{content}</div>
        )}
      </div>

      <div className="actions">
        <Link href="/upload/source" className="btn">
          ← Back
        </Link>
        <Link href="/upload/topics" className="btn primary">
          Choose topics →
        </Link>
      </div>
    </>
  );
}
