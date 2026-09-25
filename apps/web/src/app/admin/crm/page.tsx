"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  DataState,
  Field,
  FieldRow,
  Input,
  Select,
  Pagination,
  TableWrap,
} from "../../../components/ds";

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

/** Funnel stages come back as enum constants. An operator reads the stage,
 * not the constant, so each is named and toned. */
const STAGES: { value: string; label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }[] = [
  { value: "LEAD", label: "سرنخ", tone: "neutral" },
  { value: "ACTIVATED", label: "فعال‌شده", tone: "info" },
  { value: "AT_RISK", label: "در معرض ریزش", tone: "warning" },
  { value: "QUALIFIED", label: "واجد شرایط", tone: "info" },
  { value: "CUSTOMER", label: "مشتری", tone: "success" },
  { value: "ADVOCATE", label: "مروّج", tone: "success" },
];
const stageOf = (value: string) => STAGES.find((stage) => stage.value === value);

const LEAD_PAGE_SIZE = 25;

export default function CrmDashboardPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("");
  const [leadPage, setLeadPage] = useState(1);
  const [leadTotal, setLeadTotal] = useState(0);

  const [campaignCode, setCampaignCode] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignUrl, setCampaignUrl] = useState("/courses");
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [campaignDone, setCampaignDone] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      setReport(await apiFetch<Report>("/admin/crm/report"));
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "خواندن گزارش ممکن نشد.");
    } finally {
      setReportLoading(false);
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    setLeadsError(null);
    try {
      const query = new URLSearchParams({ page: String(leadPage), pageSize: String(LEAD_PAGE_SIZE) });
      if (stageFilter) query.set("stage", stageFilter);
      const res = await apiFetch<{ items: Lead[]; total: number }>(`/admin/crm/leads?${query}`);
      setLeads(res.items);
      setLeadTotal(res.total);
    } catch (err) {
      setLeadsError(err instanceof Error ? err.message : "خواندن سرنخ‌ها ممکن نشد.");
    } finally {
      setLeadsLoading(false);
    }
  }, [stageFilter, leadPage]);

  useEffect(() => { void loadReport(); }, [loadReport]);
  useEffect(() => { void loadLeads(); }, [loadLeads]);

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    setCampaignBusy(true);
    setCampaignError(null);
    setCampaignDone(null);
    try {
      await apiFetch("/admin/crm/campaigns", {
        method: "POST",
        body: { code: campaignCode, title: campaignTitle, targetUrl: campaignUrl },
      });
      setCampaignDone(`کمپین «${campaignTitle}» ساخته شد.`);
      setCampaignCode("");
      setCampaignTitle("");
      await loadReport();
    } catch (err) {
      setCampaignError(err instanceof Error ? err.message : "ساخت کمپین ناموفق بود.");
    } finally {
      setCampaignBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="CRM و رشد"
        description="وضعیت قیف سرنخ، درآمد و کمپین‌های لینک عمیق."
      />

      <div className="ds-stack-lg">
        <DataState loading={reportLoading} error={reportError} onRetry={loadReport} skeletonRows={2}>
          {report && (
            <>
              <div className="ds-stat-row">
                <Card><span className="ds-stat-label">کاربران</span><strong className="ds-stat-value">{toPersianDigits(report.totalUsers)}</strong></Card>
                <Card><span className="ds-stat-label">سفارش موفق</span><strong className="ds-stat-value">{toPersianDigits(report.paidOrderCount)}</strong></Card>
                <Card><span className="ds-stat-label">درآمد (ریال)</span><strong className="ds-stat-value">{report.totalRevenueRial.toLocaleString("fa-IR")}</strong></Card>
                <Card><span className="ds-stat-label">دسترسی فعال</span><strong className="ds-stat-value">{toPersianDigits(report.activeEntitlements)}</strong></Card>
                <Card><span className="ds-stat-label">آزمون ثبت‌شده</span><strong className="ds-stat-value">{toPersianDigits(report.totalAttempts)}</strong></Card>
                <Card><span className="ds-stat-label">کار تکمیل‌شده</span><strong className="ds-stat-value">{toPersianDigits(report.completedTasks)}</strong></Card>
              </div>

              <Card padded={false}>
                <div className="ds-card-head"><h2 className="ds-card-title">قیف سرنخ</h2></div>
                <div className="ds-card-body">
                  <div className="ds-row">
                    {STAGES.map((stage) => (
                      <span key={stage.value} className="ds-funnel-step">
                        <Badge tone={stage.tone}>{stage.label}</Badge>
                        <strong>{toPersianDigits(report.leadsByStage[stage.value] ?? 0)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </Card>

              <Card padded={false}>
                <div className="ds-card-head"><h2 className="ds-card-title">پربازدیدترین کمپین‌ها</h2></div>
                <div className={`ds-card-body ${report.topCampaigns.length ? "ds-card-body-flush" : ""}`}>
                  {report.topCampaigns.length === 0 ? (
                    <p className="ds-subtitle">هنوز کلیکی روی کمپین‌ها ثبت نشده است.</p>
                  ) : (
                    <TableWrap>
                      <thead><tr><th>عنوان</th><th>کد</th><th>کلیک</th></tr></thead>
                      <tbody>
                        {report.topCampaigns.map((campaign) => (
                          <tr key={campaign.code}>
                            <td>{campaign.title}</td>
                            <td className="ds-code">{campaign.code}</td>
                            <td className="ds-table-numeric">{toPersianDigits(campaign.clicks)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </TableWrap>
                  )}
                </div>
              </Card>
            </>
          )}
        </DataState>

        <Card>
          <h2 className="ds-card-title">کمپین تازه</h2>
          <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)" }}>
            یک لینک عمیق قابل ردیابی می‌سازد تا بدانید بازدید از کدام کانال آمده است.
          </p>
          <form onSubmit={createCampaign} className="ds-form">
            <FieldRow>
              <Field label="کد کمپین" hint="در نشانی لینک استفاده می‌شود؛ کوتاه و لاتین" required>
                {(props) => <Input {...props} value={campaignCode} onChange={(event) => setCampaignCode(event.target.value)} required />}
              </Field>
              <Field label="عنوان کمپین" required>
                {(props) => <Input {...props} value={campaignTitle} onChange={(event) => setCampaignTitle(event.target.value)} required />}
              </Field>
            </FieldRow>
            <Field label="مقصد" hint="مسیر داخلی سایت، مثلاً ‎/courses" required>
              {(props) => <Input {...props} value={campaignUrl} onChange={(event) => setCampaignUrl(event.target.value)} required />}
            </Field>
            {campaignError && <Alert tone="danger">{campaignError}</Alert>}
            {campaignDone && <Alert tone="success">{campaignDone}</Alert>}
            <div><Button type="submit" variant="primary" loading={campaignBusy}>ساخت کمپین</Button></div>
          </form>
        </Card>

        <Card padded={false}>
          <div className="ds-card-head">
            <div>
              <h2 className="ds-card-title">سرنخ‌ها</h2>
              <p>سرویس حداکثر ۵۰ سرنخ برمی‌گرداند؛ برای دیدن بیشتر باید صفحه‌بندی سمت سرور اضافه شود.</p>
            </div>
            <div style={{ minWidth: "12rem" }}>
              <Select value={stageFilter} onChange={(event) => { setStageFilter(event.target.value); setLeadPage(1); }} aria-label="فیلتر مرحله">
                <option value="">همهٔ مرحله‌ها</option>
                {STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>{stage.label}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className={`ds-card-body ${leads.length && !leadsLoading && !leadsError ? "ds-card-body-flush" : ""}`}>
            <DataState
              loading={leadsLoading}
              error={leadsError}
              isEmpty={leads.length === 0}
              onRetry={loadLeads}
              emptyTitle="سرنخی در این مرحله نیست"
              emptyDescription="با تغییر فیلتر مرحله، سرنخ‌های دیگر را ببینید."
            >
              <TableWrap
                pagination={
                  leadTotal > LEAD_PAGE_SIZE ? (
                    <Pagination page={leadPage} pageSize={LEAD_PAGE_SIZE} total={leadTotal} onPageChange={setLeadPage} />
                  ) : undefined
                }
              >
                <thead><tr><th>شماره</th><th>مرحله</th><th>منبع</th><th /></tr></thead>
                <tbody>
                  {leads.map((lead) => {
                    const stage = stageOf(lead.stage);
                    return (
                      <tr key={lead.id}>
                        <td className="ds-code">{lead.user.phone}</td>
                        <td>{stage ? <Badge tone={stage.tone}>{stage.label}</Badge> : <Badge>{lead.stage}</Badge>}</td>
                        <td>
                          {lead.source ?? "—"}
                          {lead.campaignCode ? <span className="ds-code"> ({lead.campaignCode})</span> : null}
                        </td>
                        <td><Link className="text-link" href={`/admin/crm/leads/${lead.id}`}>مشاهده ←</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </DataState>
          </div>
        </Card>
      </div>
    </>
  );
}
