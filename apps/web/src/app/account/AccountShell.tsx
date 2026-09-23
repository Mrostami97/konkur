import type { ReactNode } from "react";

/**
 * The heading block of an account page. The frame around it -- sidebar, top
 * bar, onboarding -- is the StudentShell in this folder's layout; this is
 * only the page's own title, its status chips and its main action.
 */
export function AccountShell({
  title,
  subtitle,
  chips,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  chips?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="st-page">
      <header className="st-page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
          {chips && <div className="st-chips">{chips}</div>}
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
