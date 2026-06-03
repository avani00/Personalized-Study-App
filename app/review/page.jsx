import Link from "next/link";

export default function ReviewHome() {
  return (
    <>
      <div className="breadcrumb">
        <Link href="/">Home</Link> / Review old
      </div>

      <h1>Review old</h1>
      <p className="muted">Pick up where you left off or focus on weak areas.</p>

      <div className="tile-grid">
        <Link href="/review/sessions" className="tile">
          <h2>Previous topics / sessions</h2>
          <p className="muted">Browse and reopen past study sessions.</p>
        </Link>

        <Link href="/review/weak" className="tile">
          <h2>Retry weak topics</h2>
          <p className="muted">Practice the topics you've struggled with.</p>
        </Link>

        <Link href="/review/continue" className="tile">
          <h2>Continue unfinished session</h2>
          <p className="muted">Resume a session you didn't complete.</p>
        </Link>
      </div>

      <div className="actions">
        <Link href="/" className="btn">
          ← Back to Home
        </Link>
      </div>
    </>
  );
}
