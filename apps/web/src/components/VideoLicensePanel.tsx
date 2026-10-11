"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { Alert, Button, Card } from "./ds";

interface License {
  licenseKey: string;
  downloadUrl: string;
  issuedAt: string;
}

interface VideoStatus {
  hasVideo: boolean;
  hasAccess: boolean;
  request: { status: "PENDING" | "DONE"; requestedAt: string } | null;
  license: License | null;
}

/**
 * The SpotPlayer licence for a course the student has bought. The owner
 * issues licences by hand: the student asks here, the request reaches the
 * admin panel, and once the owner records the key it shows here. One key can
 * cover all the student's courses.
 */
export function VideoLicensePanel({ courseId }: { courseId: string }) {
  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await apiFetch<VideoStatus>(`/courses/${courseId}/video`));
    } catch {
      // Signed out, or the course has no video. Either way there is nothing
      // to show here, and the rest of the page still works.
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }, [courseId]);

  useEffect(() => {
    void check();
  }, [check]);

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await apiFetch<VideoStatus>(`/courses/${courseId}/video-license`, { method: "POST", body: {} }));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? "برای دریافت لایسنس ویدیو، ابتدا باید این دوره را تهیه کنید." : err instanceof Error ? err.message : "ثبت درخواست ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    const license = status?.license;
    if (!license) return;
    try {
      await navigator.clipboard.writeText(license.licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (checking || !status?.hasVideo) return null;
  const license = status.license;

  return (
    <Card>
      <span className="ds-eyebrow">ویدیوهای دوره</span>
      <h2 className="ds-title" style={{ fontSize: "var(--text-lg)", marginTop: "var(--sp-2)" }}>
        تماشا در اسپات‌پلیر
      </h2>
      <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)" }}>
        ویدیوهای این دوره در اسپات‌پلیر پخش می‌شوند؛ برنامه را نصب کنید و لایسنس زیر را در آن وارد کنید.
        لایسنس به نام شماست و روی ویدیو واترمارک می‌خورد، پس آن را با کسی به اشتراک نگذارید.
      </p>

      {!status.hasAccess ? (
        <div style={{ marginTop: "var(--sp-4)" }}>
          <Alert tone="info">برای دریافت لایسنس ویدیو، ابتدا باید این دوره را تهیه کنید.</Alert>
        </div>
      ) : license ? (
        <div className="ds-stack" style={{ marginTop: "var(--sp-4)" }}>
          <div className="pay-card">
            <div>
              <span className="ds-stat-label">کد لایسنس شما</span>
              <div className="pay-number" style={{ letterSpacing: ".06em", fontSize: "var(--text-md)" }}>
                {license.licenseKey}
              </div>
            </div>
            <Button onClick={() => void copyKey()}>{copied ? "کپی شد" : "کپی کد"}</Button>
          </div>
          <div>
            <a className="ds-btn ds-btn-primary" href={license.downloadUrl} target="_blank" rel="noreferrer">
              دریافت و نصب اسپات‌پلیر
            </a>
          </div>
        </div>
      ) : status.request?.status === "PENDING" ? (
        <div style={{ marginTop: "var(--sp-4)" }}>
          <Alert tone="info">
            درخواست لایسنس شما ثبت شد. لایسنس به‌زودی صادر می‌شود و همین‌جا نمایش داده می‌شود. اگر از قبل لایسنس
            اسپات‌پلیر از ما دارید، همان لایسنس برای این دوره هم فعال می‌شود.
          </Alert>
        </div>
      ) : (
        <div className="ds-stack" style={{ marginTop: "var(--sp-4)" }}>
          {error && <Alert tone="danger">{error}</Alert>}
          <div>
            <Button variant="primary" loading={busy} onClick={() => void issue()}>
              درخواست لایسنس ویدیو
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
