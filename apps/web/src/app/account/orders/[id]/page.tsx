"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../../lib/api";
import { formatPersianNumber, formatRial } from "../../../../lib/format";
import { AccountShell } from "../../AccountShell";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataState,
  Field,
  FieldRow,
  Input,
  Textarea,
} from "../../../../components/ds";

type PaymentStatus = "PENDING" | "AWAITING_REVIEW" | "SUCCEEDED" | "REJECTED" | "FAILED";
type OrderStatus = "PENDING" | "PAID" | "FAILED" | "CANCELED";

interface Order {
  id: string;
  status: OrderStatus;
  totalAmountRial: number;
  discountRial: number;
  createdAt: string;
  items: { id: string; amountRial: number; product: { title: string; slug: string; kind: string } }[];
  payments: {
    id: string;
    status: PaymentStatus;
    provider: string;
    referenceCode: string | null;
    receiptTrackingCode: string | null;
    receiptSubmittedAt: string | null;
    rejectionReason: string | null;
    paidAt: string | null;
    bankAccount: { bankName: string; holderName: string; cardNumber: string; iban: string | null } | null;
  }[];
}

const PAYMENT_LABEL: Record<PaymentStatus, { text: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  PENDING: { text: "در انتظار واریز شما", tone: "warning" },
  AWAITING_REVIEW: { text: "در انتظار بررسی", tone: "info" },
  SUCCEEDED: { text: "تأیید شد", tone: "success" },
  REJECTED: { text: "تأیید نشد", tone: "danger" },
  FAILED: { text: "ناموفق", tone: "danger" },
};

/** Grouped in fours, the way a card number is printed on the card, because
 * this gets copied by hand into a banking app. */
function groupCard(cardNumber: string) {
  return cardNumber.replace(/(\d{4})(?=\d)/g, "$1-");
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  });
}

/** `datetime-local` wants a local wall-clock string with no zone. */
function nowLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function OrderPaymentPage({ params: pendingParams }: { params: Promise<{ id: string }> }) {
  const params = use(pendingParams);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trackingCode, setTrackingCode] = useState("");
  const [paidAt, setPaidAt] = useState(nowLocal);
  const [fromCardLast4, setFromCardLast4] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrder(await apiFetch<Order>(`/me/orders/${params.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن این سفارش ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be refused; the number is on screen to read.
      setCopied(null);
    }
  }

  async function submitReceipt() {
    if (!order || trackingCode.trim().length < 4) return;
    setBusy(true);
    setSubmitError(null);
    setNotice(null);
    try {
      await apiFetch(`/me/orders/${order.id}/receipt`, {
        method: "POST",
        body: {
          trackingCode: trackingCode.trim(),
          paidAt: new Date(paidAt).toISOString(),
          ...(fromCardLast4.trim() ? { fromCardLast4: fromCardLast4.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      setNotice("رسید شما ثبت شد. بعد از بررسی و تأیید، دسترسی‌تان فعال می‌شود.");
      await load();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "ثبت رسید ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  const payment = order?.payments.find((row) => row.provider === "card-transfer") ?? order?.payments[0];
  const canSubmit = payment?.status === "PENDING" || payment?.status === "REJECTED";

  return (
    <AccountShell
      title="پرداخت سفارش"
      subtitle="پرداخت کارت‌به‌کارت است: مبلغ را به کارت زیر واریز کنید و بعد شمارهٔ پیگیری را همین‌جا ثبت کنید."
      action={
        <Link className="ds-btn ds-btn-secondary ds-btn-sm" href="/account/orders">
          همهٔ سفارش‌ها
        </Link>
      }
    >
      <DataState loading={loading} error={error} onRetry={load} skeletonRows={4}>
        {order && payment && (
          <div className="ds-stack-lg">
            <Card>
              <div className="ds-row-between">
                <div>
                  <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
                    {order.items.map((item) => item.product.title).join("، ")}
                  </h2>
                  <p className="ds-subtitle" style={{ marginTop: "var(--sp-1)" }}>
                    ثبت سفارش: {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <Badge tone={PAYMENT_LABEL[payment.status].tone}>{PAYMENT_LABEL[payment.status].text}</Badge>
              </div>
              <p className="ds-stat-value" style={{ marginTop: "var(--sp-4)" }}>
                {order.totalAmountRial === 0 && order.discountRial > 0 ? "رایگان" : formatRial(order.totalAmountRial)}
              </p>
              {order.discountRial > 0 && (
                <p className="ds-hint" style={{ margin: "var(--sp-1) 0 0" }}>
                  قیمت <s>{formatRial(order.totalAmountRial + order.discountRial)}</s> · کد تخفیف {formatRial(order.discountRial)} کم کرد
                </p>
              )}
            </Card>

            {payment.status === "SUCCEEDED" && (
              <Alert tone="success">
                {payment.provider === "discount"
                  ? "کد تخفیف کل مبلغ را پوشاند و دسترسی‌تان همین حالا فعال شد."
                  : "پرداخت شما تأیید شد و دسترسی‌تان فعال است."}{" "}
                می‌توانید از{" "}
                <Link href="/account" className="text-link">
                  حساب من
                </Link>{" "}
                شروع کنید.
              </Alert>
            )}

            {payment.status === "AWAITING_REVIEW" && (
              <Alert tone="info">
                رسید شما ثبت شده و در نوبت بررسی است. به‌محض تأیید، دسترسی‌تان فعال می‌شود و همین صفحه
                به‌روز خواهد شد.
                {payment.receiptTrackingCode && (
                  <>
                    {" "}
                    شمارهٔ پیگیری ثبت‌شده: <strong dir="ltr">{payment.receiptTrackingCode}</strong>
                  </>
                )}
              </Alert>
            )}

            {payment.status === "REJECTED" && (
              <Alert tone="danger">
                <span>
                  این رسید تأیید نشد
                  {payment.rejectionReason ? `: ${payment.rejectionReason}` : "."} می‌توانید اطلاعات را
                  اصلاح کنید و دوباره ثبت کنید.
                </span>
              </Alert>
            )}

            {canSubmit && payment.bankAccount && (
              <>
                <Card>
                  <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
                    ۱. مبلغ را به این کارت واریز کنید
                  </h2>
                  <div className="ds-stack" style={{ marginTop: "var(--sp-4)" }}>
                    <div className="pay-card">
                      <div>
                        <span className="ds-stat-label">شمارهٔ کارت</span>
                        <div className="pay-number">{groupCard(payment.bankAccount.cardNumber)}</div>
                        <span className="ds-hint" style={{ margin: 0 }}>
                          {payment.bankAccount.bankName} · به نام {payment.bankAccount.holderName}
                        </span>
                      </div>
                      <Button onClick={() => void copy(payment.bankAccount!.cardNumber, "card")}>
                        {copied === "card" ? "کپی شد" : "کپی شمارهٔ کارت"}
                      </Button>
                    </div>

                    <div className="pay-card">
                      <div>
                        <span className="ds-stat-label">مبلغ دقیق</span>
                        <div className="pay-number">{formatPersianNumber(order.totalAmountRial)}</div>
                        <span className="ds-hint" style={{ margin: 0 }}>
                          ریال — لطفاً دقیقاً همین مبلغ را واریز کنید
                        </span>
                      </div>
                      <Button onClick={() => void copy(String(order.totalAmountRial), "amount")}>
                        {copied === "amount" ? "کپی شد" : "کپی مبلغ"}
                      </Button>
                    </div>

                    {payment.referenceCode && (
                      <div className="pay-card">
                        <div>
                          <span className="ds-stat-label">کد پیگیری سفارش</span>
                          <div style={{ marginTop: "var(--sp-2)" }}>
                            <span className="pay-ref">{payment.referenceCode}</span>
                          </div>
                          <span className="ds-hint" style={{ margin: 0 }}>
                            اگر بانک شما امکان نوشتن توضیح دارد، این کد را بنویسید تا واریزتان سریع‌تر پیدا
                            شود.
                          </span>
                        </div>
                        <Button onClick={() => void copy(payment.referenceCode!, "ref")}>
                          {copied === "ref" ? "کپی شد" : "کپی کد"}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                <Card>
                  <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
                    ۲. رسید واریز را ثبت کنید
                  </h2>
                  <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-5)" }}>
                    شمارهٔ پیگیری همان کدی است که بانک بعد از کارت‌به‌کارت به شما می‌دهد. با همین کد، واریز
                    شما در صورت‌حساب پیدا و تأیید می‌شود.
                  </p>

                  <div className="ds-stack">
                    <FieldRow>
                      <Field label="شمارهٔ پیگیری واریز" hint="کد رهگیری بانک، دست‌کم ۴ رقم" required>
                        {(props) => (
                          <Input
                            {...props}
                            dir="ltr"
                            value={trackingCode}
                            onChange={(event) => setTrackingCode(event.target.value)}
                          />
                        )}
                      </Field>
                      <Field label="زمان واریز" required>
                        {(props) => (
                          <Input
                            {...props}
                            type="datetime-local"
                            value={paidAt}
                            onChange={(event) => setPaidAt(event.target.value)}
                          />
                        )}
                      </Field>
                    </FieldRow>

                    <Field label="چهار رقم آخر کارتی که از آن واریز کردید" hint="اختیاری، ولی بررسی را سریع‌تر می‌کند">
                      {(props) => (
                        <Input
                          {...props}
                          dir="ltr"
                          inputMode="numeric"
                          maxLength={4}
                          value={fromCardLast4}
                          onChange={(event) => setFromCardLast4(event.target.value.replace(/\D/g, ""))}
                        />
                      )}
                    </Field>

                    <Field label="توضیح" hint="اختیاری">
                      {(props) => (
                        <Textarea {...props} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
                      )}
                    </Field>

                    {submitError && <Alert tone="danger">{submitError}</Alert>}
                    {notice && !submitError && <Alert tone="success">{notice}</Alert>}

                    <div>
                      <Button
                        variant="primary"
                        loading={busy}
                        disabled={trackingCode.trim().length < 4}
                        onClick={() => void submitReceipt()}
                      >
                        ثبت رسید
                      </Button>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}
      </DataState>
    </AccountShell>
  );
}
