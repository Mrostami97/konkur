"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

interface Candidate {
  id: string;
  title: string;
  accessMode: string;
  hostingMode: string;
  reviewStatus: string;
  sourceArtifactId?: string | null;
}

/** A resource that can be a free sample: published, free, with a kept PDF. */
function isSample(resource: Candidate) {
  return (
    resource.reviewStatus === "PUBLISHED" &&
    resource.accessMode !== "ENTITLEMENT" &&
    Boolean(resource.sourceArtifactId) &&
    (resource.hostingMode === "USER_UPLOAD" || resource.hostingMode === "MIRRORED_WITH_PERMISSION")
  );
}

/**
 * The free sample of a paid handout, e.g. its first two chapters. The sample
 * is its own published resource («رایگان؛ با حساب» with the PDF of those
 * chapters); linking it puts a «خواندن نمونهٔ رایگان» button on the paid
 * handout’s page. Saved at once: it is a link, not part of the draft.
 */
export function SamplePicker({
  resourceId,
  current,
  resources,
  onSaved,
}: {
  resourceId: string;
  current: string | null;
  resources: Candidate[];
  onSaved: (sampleResourceId: string | null) => void;
}) {
  const [choice, setChoice] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => setChoice(current ?? ""), [current, resourceId]);

  const candidates = resources.filter((resource) => resource.id !== resourceId && isSample(resource));

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const sampleResourceId = choice || null;
      await apiFetch(`/admin/resources/${resourceId}/sample`, { method: "PUT", body: { sampleResourceId } });
      onSaved(sampleResourceId);
      setMessage({ tone: "ok", text: sampleResourceId ? "نمونهٔ رایگان به این جزوه وصل شد." : "نمونهٔ رایگان از این جزوه جدا شد." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "ذخیره انجام نشد." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "0.6rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
      <h4 style={{ margin: 0 }}>نمونهٔ رایگان این جزوه</h4>
      <p className="muted-copy" style={{ margin: 0 }}>
        مثلاً دو فصل اول. آن فصل‌ها را یک منبع جدا با دسترسی «رایگان؛ با حساب» و فایل PDF خودشان منتشر کنید، بعد اینجا انتخابش کنید. در صفحهٔ
        جزوه، کنار قیمت، دکمهٔ «خواندن نمونهٔ رایگان» می‌آید.
      </p>
      <label className="field-group">
        <span>نمونه</span>
        <select className="ds-select" value={choice} onChange={(event) => setChoice(event.target.value)} disabled={busy}>
          <option value="">بدون نمونهٔ رایگان</option>
          {candidates.map((resource) => (
            <option key={resource.id} value={resource.id}>{resource.title}</option>
          ))}
        </select>
      </label>
      {candidates.length === 0 && <p className="field-hint">هنوز منبع رایگانِ منتشرشده‌ای با فایل PDF نیست.</p>}
      {message && <p className={message.tone === "ok" ? "success-message" : "form-error"} role="status">{message.text}</p>}
      <button type="button" className="ds-btn ds-btn-primary" style={{ justifySelf: "start" }} onClick={() => void save()} disabled={busy || choice === (current ?? "")}>
        {busy ? "در حال ذخیره…" : "ذخیرهٔ نمونه"}
      </button>
    </div>
  );
}
