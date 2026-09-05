"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { apiFetch } from "../../../lib/api";

interface Report {
  totalUsers: number;
  leadsByStage: Record<string, number>;
  paidOrderCount: number;
  totalRevenueRial: number;
  activeEntitlements: number;
  totalAttempts: number;
  completedTasks: number;
  topCampaigns: { code: string; title: string; clicks: number }[];
}

interface Lead {
  id: string;
  stage: string;
  source: string | null;
  campaignCode: string | null;
  user: { phone: string };
  updatedAt: string;
}

const STAGES = ["LEAD", "ACTIVATED", "AT_RISK", "QUALIFIED", "CUSTOMER", "ADVOCATE"];

function CrmDashboard() {
  const [report, setReport] = useState<Report | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stageFilter, setStageFilter] = useState("");
  const [campaignCode, setCampaignCode] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignUrl, setCampaignUrl] = useState("/courses");

  async function loadLeads() {
    const params = stageFilter ? `?stage=${stageFilter}` : "";
    setLeads(await apiFetch<Lead[]>(`/admin/crm/leads${params}`));
  }

  async function loadReport() {
    setReport(await apiFetch<Report>("/admin/crm/report"));
  }

  useEffect(() => {
    loadReport().catch(() => {});
  }, []);

  useEffect(() => {
    loadLeads().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageFilter]);

  async function createCampaign(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/crm/campaigns", {
      method: "POST",
      body: { code: campaignCode, title: campaignTitle, targetUrl: campaignUrl },
    });
    setCampaignCode("");
    setCampaignTitle("");
    await loadReport();
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 820, margin: "0 auto" }}>
      <h1>CRM و رشد</h1>

      {report && (
        <div style={{ background: "#F4F8FB", padding: "1rem", borderRadius: 6, marginBottom: "1rem" }}>
          <h2>گزارش کلی</h2>
          <p>کاربران: {report.totalUsers} — سفارش‌های موفق: {report.paidOrderCount} — درآمد: {report.totalRevenueRial.toLocaleString("fa-IR")} ریال</p>
          <p>دسترسی‌های فعال: {report.activeEntitlements} — آزمون‌های ثبت‌شده: {report.totalAttempts} — کارهای تکمیل‌شده: {report.completedTasks}</p>
          <p>
            قیف سرنخ:{" "}
            {STAGES.map((s) => `${s}: ${report.leadsByStage[s] ?? 0}`).join(" — ")}
          </p>
          <h3>پربازدیدترین کمپین‌ها</h3>
          <ul>
            {report.topCampaigns.map((c) => (
              <li key={c.code}>
                {c.title} ({c.code}) — {c.clicks} کلیک
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2>کمپین جدید (لینک عمیق تلگرام)</h2>
      <form onSubmit={createCampaign} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input placeholder="code" value={campaignCode} onChange={(e) => setCampaignCode(e.target.value)} required />
        <input placeholder="عنوان" value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} required />
        <input placeholder="مقصد (مثلاً /courses)" value={campaignUrl} onChange={(e) => setCampaignUrl(e.target.value)} required />
        <button type="submit">ایجاد</button>
      </form>

      <h2>سرنخ‌ها</h2>
      <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={{ marginBottom: "0.6rem" }}>
        <option value="">همه مراحل</option>
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "right" }}>شماره</th>
            <th style={{ textAlign: "right" }}>مرحله</th>
            <th style={{ textAlign: "right" }}>منبع</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} style={{ borderBottom: "1px solid #D7E2EA" }}>
              <td style={{ padding: "0.4rem" }}>{lead.user.phone}</td>
              <td style={{ padding: "0.4rem" }}>{lead.stage}</td>
              <td style={{ padding: "0.4rem" }}>
                {lead.source ?? "—"} {lead.campaignCode ? `(${lead.campaignCode})` : ""}
              </td>
              <td style={{ padding: "0.4rem" }}>
                <Link href={`/admin/crm/leads/${lead.id}`}>مشاهده</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

export default function CrmDashboardPage() {
  return (
    <AdminGuard>
      <CrmDashboard />
    </AdminGuard>
  );
}
