"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useEffect, useId, useRef } from "react";

/* Primitives for product and admin screens. Styling lives in
 * app/design-system.css; these components exist so a screen never has to
 * remember which class names go together, and so a11y wiring (label/input
 * ids, aria-invalid, dialog focus) happens once rather than per page. */

/* --------------------------------------------------------------- buttons */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size,
  loading,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm";
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={["ds-btn", `ds-btn-${variant}`, size === "sm" ? "ds-btn-sm" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {loading ? "در حال انجام…" : children}
    </button>
  );
}

/* ---------------------------------------------------------------- fields */

/** Wraps a control with its label, hint and error, and wires the ids so the
 * label actually points at the control and errors are announced. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="ds-field">
      <label className="ds-label" htmlFor={id}>
        {label}
        {required && <span style={{ color: "var(--danger)" }}> *</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p className="ds-error-text" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="ds-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`ds-input ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`ds-textarea ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`ds-select ${props.className ?? ""}`} />;
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="ds-field-row">{children}</div>;
}

/* ----------------------------------------------------------------- cards */

export function Card({
  children,
  padded = true,
  interactive,
  className,
}: {
  children: ReactNode;
  padded?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <div
      className={["ds-card", padded ? "ds-card-padded" : "", interactive ? "ds-card-interactive" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <div>
        <h1 className="ds-title">{title}</h1>
        {description && <p className="ds-subtitle">{description}</p>}
      </div>
      {action}
    </header>
  );
}

/* ---------------------------------------------------------------- badges */

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: ReactNode;
}) {
  return <span className={`ds-badge ds-badge-${tone}`}>{children}</span>;
}

/* ---------------------------------------------------------------- states */

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "danger" | "success" | "warning" | "info";
  children: ReactNode;
}) {
  return (
    <div className={`ds-alert ds-alert-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function DsEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="ds-empty">
      <div className="ds-empty-icon">✦</div>
      <strong>{title}</strong>
      {description && <p className="ds-subtitle" style={{ maxWidth: "36rem" }}>{description}</p>}
      {action}
    </div>
  );
}

/** Shimmering placeholder rows. Shown while data loads so a screen never
 * renders as an empty page the operator might read as "there is nothing". */
export function SkeletonRows({ rows = 4, height = "2.5rem" }: { rows?: number; height?: string }) {
  return (
    <div className="ds-stack-sm" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="ds-skeleton" style={{ height }} />
      ))}
    </div>
  );
}

/**
 * One place that decides what a data region shows. Loading, failure and
 * emptiness are distinct outcomes: a screen that swallows the error and
 * renders nothing leaves the operator unable to tell "no data" from "the
 * request failed", which is what the admin pages did before this existed.
 */
export function DataState({
  loading,
  error,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRetry,
  skeletonRows,
  children,
}: {
  loading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  skeletonRows?: number;
  children: ReactNode;
}) {
  if (loading) return <SkeletonRows rows={skeletonRows} />;
  if (error) {
    return (
      <Alert tone="danger">
        <span className="ds-grow">{error}</span>
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            تلاش دوباره
          </Button>
        )}
      </Alert>
    );
  }
  if (isEmpty) {
    return <DsEmptyState title={emptyTitle ?? "موردی برای نمایش نیست"} description={emptyDescription} action={emptyAction} />;
  }
  return <>{children}</>;
}

/* ---------------------------------------------------------------- tables */

export function TableWrap({ children, pagination }: { children: ReactNode; pagination?: ReactNode }) {
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">{children}</table>
      {pagination}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="ds-pagination">
      <span>
        {first}–{last} از {total}
      </span>
      <div className="ds-row">
        <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          قبلی
        </Button>
        <span>
          صفحهٔ {page} از {lastPage}
        </span>
        <Button size="sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          بعدی
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- dialog */

/**
 * Confirmation for an action that cannot be undone. Before this, publishing,
 * bulk-rejecting an import and granting an entitlement all fired on a single
 * unguarded click.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "تأیید",
  tone = "primary",
  busy,
  confirmDisabled,
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  /** Blocks confirmation while the body below is incomplete -- used when the
   * dialog collects something, e.g. a mandatory reason. */
  confirmDisabled?: boolean;
  /** Optional body between the description and the buttons, for a dialog that
   * asks for a detail rather than only a yes/no. */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="ds-dialog-backdrop" onClick={onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="ds-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
          {title}
        </h2>
        {description && <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)" }}>{description}</p>}
        {children && <div style={{ marginTop: "var(--sp-4)" }}>{children}</div>}
        <div className="ds-row" style={{ marginTop: "var(--sp-6)", justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            انصراف
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
