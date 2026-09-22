"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { Alert, Button } from "./ds";

export function BuyButton({
  productId,
  label = "ثبت سفارش",
}: {
  productId: string;
  /** What this purchase is, in the shopper's words -- a course and a
   * consultation package are not the same act. */
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Checkout opens an order; it does not pay for it. Payment is card-to-card,
   * so the next screen is the one with the card number, the exact amount and
   * the receipt form -- not the account page, which would leave the buyer
   * with an order and no idea what to do with it.
   */
  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      const order = await apiFetch<{ id: string }>("/checkout", { method: "POST", body: { productId } });
      router.push(`/account/orders/${order.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "ثبت سفارش ناموفق بود");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ds-stack-sm">
      <div>
        <Button variant="primary" onClick={handleBuy} loading={loading}>
          {label}
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
