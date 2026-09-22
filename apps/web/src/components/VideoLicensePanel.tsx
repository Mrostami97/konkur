"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { Alert, Button, Card } from "./ds";

interface VideoStatus {
  hasVideo: boolean;
  integrationConfigured: boolean;
}

interface License {
  licenseKey: string;
  downloadUrl: string;
  issuedAt: string;
}

/**
 * The SpotPlayer licence for a course the student has bought.
 *
 * Issuance is deliberately a button rather than something that happens on
 * page load: every licence is a seat, and a course page opened out of
 * curiosity should not spend one. Once issued, the same key comes back on
 * every later visit.
 */
export function VideoLicensePanel({ courseId }: { courseId: string }) {
  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [license, setLicense] = useState<License | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
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
      setLicense(await apiFetch<License>(`/courses/${courseId}/video-license`, { method: "POST", body: {} }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setLocked(true);
      } else {
        setError(err instanceof Error ? err.message : "دریافت لایسنس ممکن نشد.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
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

      {!status.integrationConfigured ? (
        <div style={{ marginTop: "var(--sp-4)" }}>
          <Alert tone="warning">
            پخش ویدیو هنوز روی سایت فعال نشده است. اگر این دوره را خریده‌اید، برای دریافت لایسنس با پشتیبانی
            تماس بگیرید.
          </Alert>
        </div>
      ) : locked ? (
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
      ) : (
        <div className="ds-stack" style={{ marginTop: "var(--sp-4)" }}>
          {error && <Alert tone="danger">{error}</Alert>}
          <div>
            <Button variant="primary" loading={busy} onClick={() => void issue()}>
              دریافت لایسنس ویدیو
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
