"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  DataState,
  Kpi,
  KpiGrid,
  Pagination,
  Select,
  TableWrap,
} from "../../../components/ds";
import { PanelIcon } from "../../../components/PanelIcons";

type SmsStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

interface SmsSetup {
  provider: string;
  delivers: boolean;
  otpTemplateConfigured: boolean;
  adminPhones: number;
  kinds: { kind: string; label: string; tokens: string[]; templateConfigured: boolean }[];
}

interface SmsRow {
  id: string;
  kind: string;
  phone: string;
  tokens: string[];
  status: SmsStatus;
  attempts: number;
  lastError: string | null;
  provider: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface SmsPage {
  items: SmsRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Partial<Record<SmsStatus, number>>;
}

const STATUS: Record<SmsStatus, { text: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  PENDING: { text: "در صف", tone: "info" },
  SENT: { text: "فرستاده شد", tone: "success" },
  FAILED: { text: "ناموفق", tone: "danger" },
  SKIPPED: { text: "بدون قالب", tone: "warning" },
};

const PROVIDER_LABEL: Record<string, string> = { kavenegar: "کاوه‌نگار", smsir: "SMS.ir", console: "بدون درگاه (فقط لاگ)" };

const dateTime = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" });

function localPhone(phone: string) {
  return toPersianDigits(phone.startsWith("+98") ? `0${phone.slice(3)}` : phone);
}

export default function NotificationsAdminPage() {
  const [setup, setSetup] = useState<SmsSetup | null>(null);
  const [data, setData] = useState<SmsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SmsStatus | "">("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (status) query.set("status", status);
    if (kind) query.set("kind", kind);
    Promise.all([
      apiFetch<SmsSetup>("/admin/notifications/status"),
      apiFetch<SmsPage>(`/admin/notifications/sms?${query}`),
    ])
      .then(([nextSetup, nextData]) => {
        setSetup(nextSetup);
        setData(nextData);
      })
      .catch(() => setError("گزارش پیامک‌ها بارگذاری نشد."))
      .finally(() => setLoading(false));
  }, [page, status, kind]);

  useEffect(() => {
    load();
  }, [load]);

  async function retry(id: string) {
    setRetrying(id);
    try {
      await apiFetch(`/admin/notifications/sms/${id}/retry`, { method: "POST" });
      load();
    } catch {
      setError("برگرداندن پیامک به صف ممکن نشد.");
    } finally {
      setRetrying(null);
    }
  }

  const kindLabel = (value: string) => setup?.kinds.find((item) => item.kind === value)?.label ?? value;
  const missing = setup?.kinds.filter((item) => !item.templateConfigured) ?? [];

  return (
    <>
      <AdminPageHeader
        title="پیامک‌ها"
        description="پیامک‌هایی که سایت پس از پرداخت، رزرو مشاوره و … می‌فرستد؛ با وضعیت ارسال هرکدام."
        action={<Button onClick={load}>به‌روزرسانی</Button>}
      />

      {setup && (
        <div className="ds-stack">
          {!setup.delivers ? (
            <Alert tone="warning">
              <span className="ds-grow">
                درگاه پیامک تنظیم نشده است؛ کد ورود و پیامک‌ها فقط در لاگ سرور نوشته می‌شوند و به کسی نمی‌رسند. برای راه‌اندازی،
                SMS_PROVIDER (kavenegar یا smsir)، SMS_API_KEY و SMS_OTP_TEMPLATE را در تنظیمات سرور API قرار دهید.
              </span>
            </Alert>
          ) : !setup.otpTemplateConfigured ? (
            <Alert tone="danger">SMS_OTP_TEMPLATE تنظیم نشده است؛ هیچ کاربری نمی‌تواند با کد پیامکی وارد شود.</Alert>
          ) : null}
          {setup.adminPhones === 0 && (
            <Alert tone="info">
              شمارهٔ مدیری برای اعلان «رسید تازه» ثبت نشده است (SMS_ADMIN_PHONES)؛ رسیدهای کارت‌به‌کارت فقط در صف پرداخت‌ها دیده می‌شوند.
            </Alert>
          )}
          <KpiGrid>
            <Kpi label="درگاه" value={PROVIDER_LABEL[setup.provider] ?? setup.provider} icon={<PanelIcon name="sms" />} small />
            <Kpi label="فرستاده‌شده" value={toPersianDigits(data?.counts.SENT ?? 0)} tone="success" />
            <Kpi label="در صف" value={toPersianDigits(data?.counts.PENDING ?? 0)} tone="info" />
            <Kpi label="ناموفق یا بدون قالب" value={toPersianDigits((data?.counts.FAILED ?? 0) + (data?.counts.SKIPPED ?? 0))} tone="warm" />
          </KpiGrid>

          <Card>
            <h2 className="ds-card-title">قالب‌های پیامک</h2>
            <p className="ds-subtitle">
              هر نوع پیامک یک قالب تأییدشده در پنل درگاه لازم دارد که با متغیر SMS_TEMPLATE_&lt;نوع&gt; معرفی می‌شود. متغیرها به همین
              ترتیب به قالب داده می‌شوند.
            </p>
            <TableWrap>
              <thead>
                <tr>
                  <th>پیامک</th>
                  <th>متغیر تنظیم</th>
                  <th>متغیرهای قالب</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {setup.kinds.map((item) => (
                  <tr key={item.kind}>
                    <td>{item.label}</td>
                    <td><span className="ds-code" dir="ltr">SMS_TEMPLATE_{item.kind}</span></td>
                    <td>{item.tokens.join("، ")}</td>
                    <td>{item.templateConfigured ? <Badge tone="success">تنظیم شده</Badge> : <Badge tone="warning">تنظیم نشده</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {missing.length > 0 && (
              <p className="ds-hint">
                پیامکی که قالب ندارد «بدون قالب» ثبت می‌شود و پس از تنظیم قالب می‌توانید آن را دوباره به صف بفرستید.
              </p>
            )}
          </Card>
        </div>
      )}

      <Card>
        <div className="ds-row-between">
          <h2 className="ds-card-title">گزارش ارسال</h2>
          <div className="ds-row sms-filters">
            <Select aria-label="وضعیت" value={status} onChange={(event) => { setStatus(event.target.value as SmsStatus | ""); setPage(1); }}>
              <option value="">همهٔ وضعیت‌ها</option>
              {(Object.keys(STATUS) as SmsStatus[]).map((value) => (
                <option key={value} value={value}>{STATUS[value].text}</option>
              ))}
            </Select>
            <Select aria-label="نوع پیامک" value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }}>
              <option value="">همهٔ پیامک‌ها</option>
              {setup?.kinds.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
            </Select>
          </div>
        </div>
        <DataState
          loading={loading && !data}
          error={error}
          onRetry={load}
          isEmpty={data?.items.length === 0}
          emptyTitle="پیامکی ثبت نشده است"
          emptyDescription="با تأیید پرداخت یا رزرو مشاوره، پیامک مربوط به آن اینجا ثبت می‌شود."
        >
          {data && (
            <TableWrap
              pagination={<Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
            >
              <thead>
                <tr>
                  <th>زمان</th>
                  <th>پیامک</th>
                  <th>گیرنده</th>
                  <th>متغیرها</th>
                  <th>وضعیت</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td>{dateTime.format(new Date(row.createdAt))}</td>
                    <td>{kindLabel(row.kind)}</td>
                    <td dir="ltr">{localPhone(row.phone)}</td>
                    <td>{row.tokens.join("، ")}</td>
                    <td>
                      <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].text}</Badge>
                      {row.lastError && <div className="ds-hint" title={row.lastError}>{row.lastError.slice(0, 80)}</div>}
                      {row.attempts > 1 && <div className="ds-hint">{toPersianDigits(row.attempts)} تلاش</div>}
                    </td>
                    <td className="ds-table-actions">
                      {(row.status === "FAILED" || row.status === "SKIPPED") && (
                        <Button size="sm" loading={retrying === row.id} onClick={() => retry(row.id)}>
                          ارسال دوباره
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </DataState>
      </Card>
    </>
  );
}
