import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>Personalized Study App</h1>
      <p className="muted">
        Upload your study material and generate adaptive practice questions.
      </p>

      <div className="tile-grid">
        <Link href="/upload/source" className="tile">
          <h2>Upload new</h2>
          <p className="muted">Add text or a file and start a new study session.</p>
        </Link>

        <Link href="/review" className="tile">
          <h2>Review old</h2>
          <p className="muted">Revisit past sessions, weak topics, or unfinished work.</p>
        </Link>
      </div>
    </>
  );
}
