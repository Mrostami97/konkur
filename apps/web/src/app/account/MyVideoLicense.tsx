"use client";

import { useEffect, useState } from "react";
import { Glyph } from "../../components/SubjectIcon";
import { apiFetch } from "../../lib/api";
import { faDate } from "./data";

interface License {
  licenseKey: string;
  downloadUrl: string;
  issuedAt: string;
  updatedAt: string;
}

/**
 * The student's SpotPlayer key. The owner records it in the admin panel,
 * after a request or unasked (owner, 2026-10-29); either way it shows here.
 * Nothing is drawn for someone without a key.
 */
export function MyVideoLicense() {
  const [license, setLicense] = useState<License | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<{ license: License | null }>("/me/video-license")
      .then((data) => setLicense(data.license))
      .catch(() => setLicense(null));
  }, []);

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

  if (!license) return null;

  return (
    <section className="st-card">
      <header className="st-card-head">
        <h2>
          <span className="st-card-icon"><Glyph name="play" /></span>
          لایسنس اسپات‌پلیر
        </h2>
        <span className="st-field-hint">ثبت: {faDate(license.updatedAt)}</span>
      </header>
      <p className="st-field-hint" style={{ marginTop: 0 }}>
        ویدیوهای دوره‌ها در اسپات‌پلیر پخش می‌شوند. برنامه را نصب کن و این کد را در آن وارد کن. لایسنس به نام توست و روی
        ویدیو واترمارک می‌خورد، پس آن را به کسی نده.
      </p>
      <div className="st-row">
        <code dir="ltr" style={{ fontSize: "1.05rem", letterSpacing: ".06em", wordBreak: "break-all" }}>{license.licenseKey}</code>
        <button type="button" className="st-btn st-btn-soft st-btn-sm" onClick={() => void copyKey()}>
          {copied ? "کپی شد" : "کپی کد"}
        </button>
        <a className="st-btn st-btn-primary st-btn-sm" href={license.downloadUrl} target="_blank" rel="noreferrer">
          دریافت اسپات‌پلیر
        </a>
      </div>
    </section>
  );
}
