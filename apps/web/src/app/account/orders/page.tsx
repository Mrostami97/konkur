"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { formatRial, toPersianDigits } from "../../../lib/format";
import { AccountShell } from "../AccountShell";
import { Badge, Button, Card, DataState, TableWrap } from "../../../components/ds";

type PaymentStatus = "PENDING" | "AWAITING_REVIEW" | "SUCCEEDED" | "REJECTED" | "FAILED";

interface Order {
  id: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELED";
  totalAmountRial: number;
  createdAt: string;
  items: { id: string; product: { title: string; slug: string } }[];
  payments: { id: string; status: PaymentStatus; provider: string; referenceCode: string | null }[];
}

const PAYMENT_LABEL: Record<PaymentStatus, { text: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  PENDING: { text: "در انتظار واریز", tone: "warning" },
  AWAITING_REVIEW: { text: "در انتظار بررسی", tone: "info" },
  SUCCEEDED: { text: "پرداخت شد", tone: "success" },
  REJECTED: { text: "تأیید نشد", tone: "danger" },
  FAILED: { text: "ناموفق", tone: "danger" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" });
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await apiFetch<Order[]>("/me/orders"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن سفارش‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unpaid = orders.filter((order) => order.status === "PENDING").length;

  return (
    <AccountShell
      title="سفارش‌های من"
      subtitle="پرداخت کارت‌به‌کارت است؛ سفارشی که رسیدش ثبت و تأیید نشده باشد هنوز دسترسی نمی‌دهد."
      chips={unpaid > 0 ? <span className="st-chip">{toPersianDigits(unpaid)} سفارش در انتظار پرداخت</span> : undefined}
    >
      <Card padded={false}>
        <div style={{ padding: orders.length && !loading && !error ? 0 : "var(--sp-4)" }}>
          <DataState
            loading={loading}
            error={error}
            isEmpty={orders.length === 0}
            onRetry={load}
            emptyTitle="هنوز سفارشی ثبت نکرده‌اید"
            emptyDescription="دوره‌ها، بانک سؤال و مشاوره‌ها را می‌توانید از صفحه‌های خودشان سفارش دهید."
            skeletonRows={4}
          >
            <TableWrap>
              <thead>
                <tr>
                  <th>سفارش</th>
                  <th>تاریخ</th>
                  <th>مبلغ</th>
                  <th>وضعیت پرداخت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const payment = order.payments.find((row) => row.provider === "card-transfer") ?? order.payments[0];
                  const label = payment ? PAYMENT_LABEL[payment.status] : null;
                  return (
                    <tr key={order.id}>
                      <td>{order.items.map((item) => item.product.title).join("، ")}</td>
                      <td className="ds-table-numeric">{formatDate(order.createdAt)}</td>
                      <td className="ds-table-numeric">{formatRial(order.totalAmountRial)}</td>
                      <td>{label ? <Badge tone={label.tone}>{label.text}</Badge> : <Badge>—</Badge>}</td>
                      <td>
                        <Link href={`/account/orders/${order.id}`}>
                          <Button size="sm" variant={order.status === "PENDING" ? "primary" : "secondary"}>
                            {order.status === "PENDING" ? "پرداخت" : "جزئیات"}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          </DataState>
        </div>
      </Card>
    </AccountShell>
  );
}
