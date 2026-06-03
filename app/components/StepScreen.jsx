import Link from "next/link";

/**
 * Generic stub screen used to scaffold the app flow.
 * Renders a breadcrumb, a title, optional placeholder blocks, and
 * wired-up navigation buttons. Replace the placeholders with real
 * UI/logic as each screen is built out.
 */
export default function StepScreen({ breadcrumb, title, subtitle, blocks = [], actions = [] }) {
  return (
    <>
      {breadcrumb && (
        <div className="breadcrumb">
          {breadcrumb.map((crumb, i) => (
            <span key={i}>
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : crumb.label}
              {i < breadcrumb.length - 1 ? " / " : ""}
            </span>
          ))}
        </div>
      )}

      <h1>{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}

      {blocks.map((block, i) => (
        <div key={i} className="placeholder">
          {block}
        </div>
      ))}

      {actions.length > 0 && (
        <div className="actions">
          {actions.map((action, i) => (
            <Link
              key={i}
              href={action.href}
              className={`btn${action.primary ? " primary" : ""}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
