"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminGuard } from "../../../../../components/AdminGuard";
import { apiFetch } from "../../../../../lib/api";

interface CaseItem {
  id: string;
  subject: string;
  status: string;
}

interface InteractionItem {
  id: string;
  type: string;
  note: string;
  createdAt: string;
}

interface LeadDetail {
  id: string;
  stage: string;
  source: string | null;
  campaignCode: string | null;
  user: { phone: string };
  cases: CaseItem[];
  interactions: InteractionItem[];
}

function LeadDetail({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [caseSubject, setCaseSubject] = useState("");
  const [interactionType, setInteractionType] = useState("note");
  const [interactionNote, setInteractionNote] = useState("");

  const load = useCallback(async () => {
    setLead(await apiFetch<LeadDetail>(`/admin/crm/leads/${leadId}`));
  }, [leadId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function recompute() {
    await apiFetch(`/admin/crm/leads/${leadId}/recompute`, { method: "POST" });
    await load();
  }

  async function addCase(e: FormEvent) {
    e.preventDefault();
    await apiFetch(`/admin/crm/leads/${leadId}/cases`, { method: "POST", body: { subject: caseSubject } });
    setCaseSubject("");
    await load();
  }

  async function resolveCase(caseId: string) {
    await apiFetch(`/admin/crm/cases/${caseId}/resolve`, { method: "POST" });
    await load();
  }

  async function addInteraction(e: FormEvent) {
    e.preventDefault();
    await apiFetch(`/admin/crm/leads/${leadId}/interactions`, {
      method: "POST",
      body: { type: interactionType, note: interactionNote },
    });
    setInteractionNote("");
    await load();
  }

  if (!lead) return <main style={{ padding: "2rem" }}>در حال بارگذاری...</main>;

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>{lead.user.phone}</h1>
      <p>
        مرحله: <strong>{lead.stage}</strong>
        <button onClick={recompute} style={{ marginInlineStart: "0.5rem" }}>
          بازمحاسبه مرحله
        </button>
      </p>
      <p>منبع: {lead.source ?? "—"} {lead.campaignCode ? `(${lead.campaignCode})` : ""}</p>

      <h2>پرونده‌ها</h2>
      <form onSubmit={addCase} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
        <input placeholder="موضوع" value={caseSubject} onChange={(e) => setCaseSubject(e.target.value)} required />
        <button type="submit">ایجاد پرونده</button>
      </form>
      <ul>
        {lead.cases.map((c) => (
          <li key={c.id}>
            {c.subject} — {c.status}
            {c.status === "OPEN" && (
              <button onClick={() => resolveCase(c.id)} style={{ marginInlineStart: "0.5rem" }}>
                حل شد
              </button>
            )}
          </li>
        ))}
      </ul>

      <h2>تعاملات</h2>
      <form onSubmit={addInteraction} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
        <select value={interactionType} onChange={(e) => setInteractionType(e.target.value)}>
          <option value="note">یادداشت</option>
          <option value="call">تماس</option>
          <option value="risk_alert">هشدار ریزش</option>
        </select>
        <input placeholder="متن" value={interactionNote} onChange={(e) => setInteractionNote(e.target.value)} required style={{ flex: 1 }} />
        <button type="submit">ثبت</button>
      </form>
      <ul>
        {lead.interactions.map((i) => (
          <li key={i.id}>
            [{i.type}] {i.note} — {new Date(i.createdAt).toLocaleDateString("fa-IR")}
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  return (
    <AdminGuard>
      <LeadDetail leadId={params.id} />
    </AdminGuard>
  );
}
