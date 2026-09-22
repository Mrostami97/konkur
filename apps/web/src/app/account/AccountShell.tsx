"use client";

import type { ReactNode } from "react";
import { AccountTabs } from "./AccountTabs";

/**
 * Frame for every account screen: a dark greeting band with the tab row on
 * its bottom edge, then the page body.
 *
 * The band's copy is passed in rather than fixed here, because the greeting is
 * the student's own -- their name, their target, their remaining sessions --
 * and that is what makes the area feel like theirs rather than a settings page.
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
    <>
      <div className="acc-band">
        <div className="acc-band-inner">
          <div>
            <h1 className="acc-hello">{title}</h1>
            {subtitle && <p className="acc-sub">{subtitle}</p>}
            {chips && <div className="acc-chips">{chips}</div>}
          </div>
          {action}
        </div>
        <AccountTabs />
      </div>
      <main className="acc-body">{children}</main>
    </>
  );
}
