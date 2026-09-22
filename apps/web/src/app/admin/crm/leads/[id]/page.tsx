"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../../../lib/api";
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
  TableWrap,
} from "../../../../../components/ds";

interface CaseItem { id: string; subject: string; status: string }
interface InteractionItem { id: string; type: string; note: string; createdAt: string }

interface LeadDetail {
  id: string;
  stage: string;
  source: string | null;
  campaignCode: string | null;
  user: { phone: string };
  cases: CaseItem[];
  interactions: InteractionItem[];
}

const STAGE_LABEL: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" }> = {
  LEAD: { label: "سرنخ", tone: "neutral" },
  ACTIVATED: { label: "فعال‌شده", tone: "info" },
  AT_RISK: { label: "در معرض ریزش", tone: "warning" },
  QUALIFIED: { label: "واجد شرایط", tone: "info" },
  CUSTOMER: { label: "مشتری", tone: "success" },
  ADVOCATE: { label: "مروّج", tone: "success" },
};

const INTERACTION_LABEL: Record<string, string> = {
  note: "یادداشت",
  call: "تماس",
  risk_alert: "هشدار ریزش",
};

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const leadId = params.id;
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);

  const [caseSubject, setCaseSubject] = useState("");
  const [caseBusy, setCaseBusy] = useState(false);

  const [interactionType, setInteractionType] = useState("note");
  const [interactionNote, setInteractionNote] = useState("");
  const [interactionBusy, setInteractionBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLead(await apiFetch<LeadDetail>(`/admin/crm/leads/${leadId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن اطلاعات سرنخ ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(work: () => Promise<unknown>, onDone: () => void, setBusy: (value: boolean) => void, failure: string) {
    setBusy(true);
    setActionError(null);
    try {
      await work();
      onDone();
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : failure);
    } finally {
      setBusy(false);
    }
  }

  const stage = lead ? STAGE_LABEL[lead.stage] : undefined;

  return (
    <>
      <AdminPageHeader
        title={lead?.user.phone ?? "سرنخ"}
        description="پرونده‌ها و تعامل‌های این کاربر. مرحله از روی رفتار واقعی محاسبه می‌شود، نه دستی."
        action={<Link className="ds-btn ds-btn-secondary ds-btn-sm" href="/admin/crm">بازگشت به فهرست</Link>}
      />

      {actionError && <Alert tone="danger">{actionError}</Alert>}

      <DataState loading={loading} error={error} onRetry={load} skeletonRows={3}>
        {lead && (
          <div className="ds-stack-lg">
            <Card>
              <div className="ds-row-between">
                <div className="ds-row">
                  {stage ? <Badge tone={stage.tone}>{stage.label}</Badge> : <Badge>{lead.stage}</Badge>}
                  <span className="ds-subtitle">
                    منبع: {lead.source ?? "—"}
                    {lead.campaignCode ? <span className="ds-code"> ({lead.campaignCode})</span> : null}
                  </span>
                </div>
                <Button
                  size="sm"
                  loading={recomputing}
                  onClick={() => run(
                    () => apiFetch(`/admin/crm/leads/${leadId}/recompute`, { method: "POST" }),
                    () => {},
                    setRecomputing,
                    "بازمحاسبهٔ مرحله ناموفق بود.",
                  )}
                >
                  بازمحاسبهٔ مرحله
                </Button>
              </div>
            </Card>

            <Card>
              <h2 className="ds-card-title">پروندهٔ تازه</h2>
              <form
                className="ds-form"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  void run(
                    () => apiFetch(`/admin/crm/leads/${leadId}/cases`, { method: "POST", body: { subject: caseSubject } }),
                    () => setCaseSubject(""),
                    setCaseBusy,
                    "ساخت پرونده ناموفق بود.",
                  );
                }}
              >
                <Field label="موضوع پرونده" hint="مثلاً «مشکل در دسترسی دوره»" required>
                  {(props) => <Input {...props} value={caseSubject} onChange={(event) => setCaseSubject(event.target.value)} required />}
                </Field>
                <div><Button type="submit" variant="primary" loading={caseBusy}>ساخت پرونده</Button></div>
              </form>
            </Card>

            <Card padded={false}>
              <div className="ds-card-head"><h2 className="ds-card-title">پرونده‌ها</h2></div>
              <div className={`ds-card-body ${lead.cases.length ? "ds-card-body-flush" : ""}`}>
                {lead.cases.length === 0 ? (
                  <p className="ds-subtitle">پرونده‌ای برای این کاربر ثبت نشده است.</p>
                ) : (
                  <TableWrap>
                    <thead><tr><th>موضوع</th><th>وضعیت</th><th /></tr></thead>
                    <tbody>
                      {lead.cases.map((item) => (
                        <tr key={item.id}>
                          <td>{item.subject}</td>
                          <td>
                            <Badge tone={item.status === "OPEN" ? "warning" : "success"}>
                              {item.status === "OPEN" ? "باز" : "بسته"}
                            </Badge>
                          </td>
                          <td>
                            {item.status === "OPEN" && (
                              <Button
                                size="sm"
                                onClick={() => run(
                                  () => apiFetch(`/admin/crm/cases/${item.id}/resolve`, { method: "POST" }),
                                  () => {},
                                  () => {},
                                  "بستن پرونده ناموفق بود.",
                                )}
                              >
                                بستن پرونده
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="ds-card-title">ثبت تعامل</h2>
              <form
                className="ds-form"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  void run(
                    () => apiFetch(`/admin/crm/leads/${leadId}/interactions`, {
                      method: "POST",
                      body: { type: interactionType, note: interactionNote },
                    }),
                    () => setInteractionNote(""),
                    setInteractionBusy,
                    "ثبت تعامل ناموفق بود.",
                  );
                }}
              >
                <FieldRow>
                  <Field label="نوع تعامل" required>
                    {(props) => (
                      <Select {...props} value={interactionType} onChange={(event) => setInteractionType(event.target.value)}>
                        {Object.entries(INTERACTION_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="متن" required>
                    {(props) => <Input {...props} value={interactionNote} onChange={(event) => setInteractionNote(event.target.value)} required />}
                  </Field>
                </FieldRow>
                <div><Button type="submit" variant="primary" loading={interactionBusy}>ثبت تعامل</Button></div>
              </form>
            </Card>

            <Card padded={false}>
              <div className="ds-card-head"><h2 className="ds-card-title">تعامل‌ها</h2></div>
              <div className={`ds-card-body ${lead.interactions.length ? "ds-card-body-flush" : ""}`}>
                {lead.interactions.length === 0 ? (
                  <p className="ds-subtitle">هنوز تعاملی ثبت نشده است.</p>
                ) : (
                  <TableWrap>
                    <thead><tr><th>نوع</th><th>متن</th><th>تاریخ</th></tr></thead>
                    <tbody>
                      {lead.interactions.map((item) => (
                        <tr key={item.id}>
                          <td><Badge>{INTERACTION_LABEL[item.type] ?? item.type}</Badge></td>
                          <td>{item.note}</td>
                          <td className="ds-table-numeric">{new Date(item.createdAt).toLocaleDateString("fa-IR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                )}
              </div>
            </Card>
          </div>
        )}
      </DataState>
    </>
  );
}
