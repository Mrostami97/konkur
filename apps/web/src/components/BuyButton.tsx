"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { Alert, Button } from "./ds";

export function BuyButton({
  productId,
  label = "خرید دوره",
  redirectTo = "/account",
}: {
  productId: string;
  /** What this purchase is, in the shopper's words -- a course and a
   * consultation package are not the same act. */
  label?: string;
  /** Where to land afterwards. A consultation sends the student to the screen
   * where they book the session they have just paid for, not to a generic
   * account page that would leave them wondering what to do next. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/checkout", { method: "POST", body: { productId } });
      router.push(redirectTo);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "خرید ناموفق بود");
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
