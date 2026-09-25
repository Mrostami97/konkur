"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { formatPersianNumber, formatRial } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataState,
  Field,
  FieldRow,
  Input,
  Kpi,
  KpiGrid,
  Pagination,
  Select,
  TableWrap,
  Textarea,
} from "../../../components/ds";
import { PanelIcon } from "../../../components/PanelIcons";

type PaymentStatus = "PENDING" | "AWAITING_REVIEW" | "SUCCEEDED" | "REJECTED" | "FAILED";

const PAGE_SIZE = 25;

interface Payment {
  id: string;
  status: PaymentStatus;
  amountRial: number;
  referenceCode: string | null;
  receiptTrackingCode: string | null;
  receiptPaidAt: string | null;
  receiptFromCardLast4: string | null;
  receiptNote: string | null;
  receiptSubmittedAt: string | null;
  rejectionReason: string | null;
  bankAccount: { bankName: string; cardNumber: string; holderName: string } | null;
  order: {
    id: string;
    createdAt: string;
    user: { id: string; phone: string; profile: { displayName: string | null } | null };
    items: { id: string; product: { id: string; title: string; kind: string } }[];
  };
}

interface PaymentPage {
  items: Payment[];
  total: number;
  page: number;
  pageSize: number;
}

interface BankAccount {
  id: string;
  bankName: string;
  holderName: string;
  cardNumber: string;
  iban: string | null;
  isActive: boolean;
  sortOrder: number;
}

const STATUS_LABEL: Record<PaymentStatus, { text: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  PENDING: { text: "در انتظار واریز", tone: "warning" },
  AWAITING_REVIEW: { text: "در انتظار بررسی", tone: "info" },
  SUCCEEDED: { text: "تأیید شد", tone: "success" },
  REJECTED: { text: "تأیید نشد", tone: "danger" },
  FAILED: { text: "ناموفق", tone: "danger" },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  });
}

function groupCard(cardNumber: string) {
  return cardNumber.replace(/(\d{4})(?=\d)/g, "-$1").replace(/^-/, "");
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [awaiting, setAwaiting] = useState<{ count: number; amountRial: number; partial: boolean }>({ count: 0, amountRial: 0, partial: false });
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [status, setStatus] = useState<PaymentStatus>("AWAITING_REVIEW");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [confirming, setConfirming] = useState<Payment | null>(null);
  const [rejecting, setRejecting] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The KPIs always describe the review queue, whichever tab is open.
      const [paymentList, queue, accountList] = await Promise.all([
        apiFetch<PaymentPage>(`/admin/payments?status=${status}&page=${page}&pageSize=${PAGE_SIZE}`),
        apiFetch<PaymentPage>("/admin/payments?status=AWAITING_REVIEW&pageSize=100"),
        apiFetch<BankAccount[]>("/admin/bank-accounts"),
      ]);
      setPayments(paymentList.items);
      setPaymentTotal(paymentList.total);
      setAwaiting({
        count: queue.total,
        amountRial: queue.items.reduce((sum, row) => sum + row.amountRial, 0),
        partial: queue.total > queue.items.length,
      });
      setAccounts(accountList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن پرداخت‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, action: () => Promise<string>) {
    setBusy(key);
    setActionError(null);
    setNotice(null);
    try {
      setNotice(await action());
      await load();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "انجام این عملیات ممکن نشد.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function confirmPayment() {
    const target = confirming;
    if (!target) return;
    const ok = await run(`${target.id}:confirm`, async () => {
      await apiFetch(`/admin/payments/${target.id}/confirm`, { method: "POST", body: {} });
      return `پرداخت ${formatRial(target.amountRial)} تأیید شد و دسترسی خریدار فعال شد.`;
    });
    if (ok) setConfirming(null);
  }

  async function rejectPayment() {
    const target = rejecting;
    const reason = rejectReason.trim();
    if (!target || reason.length < 3) return;
    const ok = await run(`${target.id}:reject`, async () => {
      await apiFetch(`/admin/payments/${target.id}/reject`, { method: "POST", body: { reason } });
      return "رسید رد شد. خریدار می‌تواند اطلاعات را اصلاح و دوباره ثبت کند.";
    });
    if (ok) {
      setRejecting(null);
      setRejectReason("");
    }
  }

  const activeAccount = accounts.find((account) => account.isActive);

  return (
    <>
      <AdminPageHeader
        title="پرداخت‌های کارت‌به‌کارت"
        description="رسیدهایی که خریداران ثبت کرده‌اند. تأیید هر رسید یعنی مبلغ را در صورت‌حساب بانک دیده‌اید — تنها همین کار دسترسی خریدار را فعال می‌کند."
      />

      <div className="ds-stack-lg">
        {!activeAccount && (
          <Alert tone="danger">
            هیچ کارت فعالی برای دریافت وجه تنظیم نشده است. تا وقتی کارتی اضافه نکنید، هیچ سفارش تازه‌ای ثبت
            نمی‌شود.
          </Alert>
        )}
        {actionError && <Alert tone="danger">{actionError}</Alert>}
        {notice && !actionError && <Alert tone="success">{notice}</Alert>}

        <KpiGrid>
          <Kpi
            label="در انتظار بررسی"
            value={formatPersianNumber(awaiting.count)}
            hint="رسیدهایی که هنوز بررسی نشده‌اند"
            icon={<PanelIcon name="clock" />}
            tone="warm"
          />
          <Kpi
            label="مبلغ در انتظار تأیید"
            value={formatRial(awaiting.amountRial)}
            hint={awaiting.partial ? "جمع صد رسید قدیمی‌تر صف" : "جمع رسیدهای بررسی‌نشده"}
            icon={<PanelIcon name="money" />}
            tone="info"
            small
          />
          <Kpi
            label="کارت فعال"
            value={activeAccount ? groupCard(activeAccount.cardNumber) : "—"}
            hint={activeAccount ? `${activeAccount.bankName} · ${activeAccount.holderName}` : "تنظیم نشده"}
            icon={<PanelIcon name="commerce" />}
            tone={activeAccount ? "success" : "warm"}
            small
          />
        </KpiGrid>

        <Card padded={false}>
          <div className="ds-card-head">
            <div style={{ width: "18rem" }}>
              <Field label="نمایش">
                {(props) => (
                  <Select {...props} value={status} onChange={(event) => { setStatus(event.target.value as PaymentStatus); setPage(1); }}>
                    <option value="AWAITING_REVIEW">در انتظار بررسی</option>
                    <option value="PENDING">در انتظار واریز خریدار</option>
                    <option value="SUCCEEDED">تأییدشده</option>
                    <option value="REJECTED">ردشده</option>
                  </Select>
                )}
              </Field>
            </div>
          </div>

          <div style={{ padding: payments.length && !loading && !error ? 0 : "var(--sp-4)" }}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={payments.length === 0}
              onRetry={load}
              emptyTitle="موردی در این وضعیت نیست"
              emptyDescription="رسیدهایی که خریداران ثبت کنند اینجا برای بررسی می‌آیند."
              skeletonRows={4}
            >
              <TableWrap
                pagination={
                  paymentTotal > PAGE_SIZE ? (
                    <Pagination page={page} pageSize={PAGE_SIZE} total={paymentTotal} onPageChange={setPage} />
                  ) : undefined
                }
              >
                <thead>
                  <tr>
                    <th>خریدار</th>
                    <th>محصول</th>
                    <th>مبلغ</th>
                    <th>کد سفارش</th>
                    <th>شمارهٔ پیگیری</th>
                    <th>زمان واریز</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const label = STATUS_LABEL[payment.status];
                    const name = payment.order.user.profile?.displayName?.trim();
                    return (
                      <tr key={payment.id}>
                        <td>
                          {name || "بدون نام"}
                          <div style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }} dir="ltr">
                            {payment.order.user.phone}
                          </div>
                        </td>
                        <td>{payment.order.items.map((item) => item.product.title).join("، ")}</td>
                        <td className="ds-table-numeric">{formatRial(payment.amountRial)}</td>
                        <td className="ds-table-numeric" dir="ltr">
                          {payment.referenceCode ?? "—"}
                        </td>
                        <td className="ds-table-numeric" dir="ltr">
                          {payment.receiptTrackingCode ?? "—"}
                          {payment.receiptFromCardLast4 && (
                            <div style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
                              کارت ****{payment.receiptFromCardLast4}
                            </div>
                          )}
                        </td>
                        <td className="ds-table-numeric">
                          {payment.receiptPaidAt ? formatDateTime(payment.receiptPaidAt) : "—"}
                        </td>
                        <td>
                          <Badge tone={label.tone}>{label.text}</Badge>
                          {payment.rejectionReason && (
                            <div style={{ color: "var(--muted)", fontSize: "var(--text-sm)", marginTop: "var(--sp-1)" }}>
                              {payment.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td>
                          {payment.status === "AWAITING_REVIEW" ? (
                            <div className="ds-table-actions">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  setActionError(null);
                                  setNotice(null);
                                  setConfirming(payment);
                                }}
                                disabled={busy !== null}
                              >
                                تأیید
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  setActionError(null);
                                  setNotice(null);
                                  setRejectReason("");
                                  setRejecting(payment);
                                }}
                                disabled={busy !== null}
                              >
                                رد
                              </Button>
                            </div>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </DataState>
          </div>
        </Card>

        <BankAccountsCard accounts={accounts} onChanged={load} />
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title="این واریز را در صورت‌حساب دیده‌اید؟"
        description={`با تأیید، سفارش «پرداخت‌شده» می‌شود و دسترسی خریدار بلافاصله فعال می‌گردد. این کار برگشت‌پذیر نیست — برای پس‌گرفتن باید دسترسی را جداگانه باطل کنید.`}
        confirmLabel="بله، واریز را دیدم"
        busy={busy === `${confirming?.id}:confirm`}
        onConfirm={() => void confirmPayment()}
        onCancel={() => setConfirming(null)}
      >
        {confirming && (
          <div className="ds-stack-sm">
            <div className="ds-stat-row">
              <div>
                <span className="ds-stat-label">مبلغ</span>
                <span className="ds-stat-value" style={{ fontSize: "var(--text-lg)" }}>
                  {formatRial(confirming.amountRial)}
                </span>
              </div>
              <div>
                <span className="ds-stat-label">شمارهٔ پیگیری</span>
                <span className="ds-stat-value" style={{ fontSize: "var(--text-lg)" }} dir="ltr">
                  {confirming.receiptTrackingCode ?? "—"}
                </span>
              </div>
            </div>
            {confirming.receiptNote && <p className="ds-hint">یادداشت خریدار: {confirming.receiptNote}</p>}
            {actionError && <Alert tone="danger">{actionError}</Alert>}
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={rejecting !== null}
        title="این رسید رد شود؟"
        description="خریدار دلیل را می‌بیند و می‌تواند اطلاعات را اصلاح کند و دوباره ثبت کند."
        confirmLabel="رد کن"
        tone="danger"
        busy={busy === `${rejecting?.id}:reject`}
        confirmDisabled={rejectReason.trim().length < 3}
        onConfirm={() => void rejectPayment()}
        onCancel={() => {
          setRejecting(null);
          setRejectReason("");
        }}
      >
        <Field label="دلیل" hint="برای خریدار نمایش داده می‌شود" required>
          {(props) => (
            <Textarea
              {...props}
              rows={3}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="مثلاً: این شمارهٔ پیگیری در صورت‌حساب پیدا نشد."
            />
          )}
        </Field>
        {actionError && (
          <div style={{ marginTop: "var(--sp-3)" }}>
            <Alert tone="danger">{actionError}</Alert>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

function BankAccountsCard({ accounts, onChanged }: { accounts: BankAccount[]; onChanged: () => void }) {
  const [bankName, setBankName] = useState("");
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [iban, setIban] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    try {
      await apiFetch("/admin/bank-accounts", {
        method: "POST",
        body: {
          bankName,
          holderName,
          cardNumber: cardNumber.replace(/\D/g, ""),
          ...(iban.trim() ? { iban: iban.trim().toUpperCase() } : {}),
        },
      });
      setBankName("");
      setHolderName("");
      setCardNumber("");
      setIban("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت کارت ممکن نشد.");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(account: BankAccount) {
    setBusy(account.id);
    setError(null);
    try {
      await apiFetch(`/admin/bank-accounts/${account.id}`, {
        method: "PATCH",
        body: {
          bankName: account.bankName,
          holderName: account.holderName,
          cardNumber: account.cardNumber,
          ...(account.iban ? { iban: account.iban } : {}),
          isActive: !account.isActive,
          sortOrder: account.sortOrder,
        },
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تغییر وضعیت کارت ممکن نشد.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
        کارت‌های دریافت وجه
      </h2>
      <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-5)" }}>
        کارتی که فعال باشد به خریداران نشان داده می‌شود. اگر بیش از یکی فعال باشد، کارت با کمترین ترتیب
        نمایش انتخاب می‌شود.
      </p>

      {error && <Alert tone="danger">{error}</Alert>}

      {accounts.length > 0 && (
        <div style={{ marginBottom: "var(--sp-5)" }}>
          <TableWrap>
            <thead>
              <tr>
                <th>بانک</th>
                <th>به نام</th>
                <th>شمارهٔ کارت</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.bankName}</td>
                  <td>{account.holderName}</td>
                  <td className="ds-table-numeric" dir="ltr">
                    {groupCard(account.cardNumber)}
                  </td>
                  <td>{account.isActive ? <Badge tone="success">فعال</Badge> : <Badge>غیرفعال</Badge>}</td>
                  <td>
                    <Button size="sm" onClick={() => void toggle(account)} loading={busy === account.id} disabled={busy !== null}>
                      {account.isActive ? "غیرفعال کن" : "فعال کن"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}

      <form onSubmit={create} className="ds-stack">
        <FieldRow>
          <Field label="نام بانک" required>
            {(props) => <Input {...props} value={bankName} onChange={(event) => setBankName(event.target.value)} required />}
          </Field>
          <Field label="به نام" required>
            {(props) => (
              <Input {...props} value={holderName} onChange={(event) => setHolderName(event.target.value)} required />
            )}
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="شمارهٔ کارت" hint="۱۶ رقم" required>
            {(props) => (
              <Input
                {...props}
                dir="ltr"
                inputMode="numeric"
                value={cardNumber}
                onChange={(event) => setCardNumber(event.target.value)}
                required
              />
            )}
          </Field>
          <Field label="شبا" hint="اختیاری، با IR">
            {(props) => (
              <Input {...props} dir="ltr" value={iban} onChange={(event) => setIban(event.target.value)} />
            )}
          </Field>
        </FieldRow>
        <div>
          <Button type="submit" variant="primary" loading={busy === "create"}>
            افزودن کارت
          </Button>
        </div>
      </form>
    </Card>
  );
}
