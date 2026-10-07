"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { formatRial } from "../lib/format";
import { Alert, Button, Input } from "./ds";
import "./price.css";

interface Quote {
  code: string;
  subtotalRial: number;
  discountRial: number;
  totalRial: number;
}

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

  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  /** A signed-out shopper has to log in before anything about the order. */
  function toLogin(err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      router.push("/login");
      return true;
    }
    return false;
  }

  /**
   * Checkout opens an order; it does not pay for it. Payment is card-to-card,
   * so the next screen is the one with the card number, the exact amount and
   * the receipt form -- not the account page, which would leave the buyer
   * with an order and no idea what to do with it. A code that covers the
   * whole price comes back already paid, and the same page says so.
   */
  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      const order = await apiFetch<{ id: string }>("/checkout", {
        method: "POST",
        body: { productId, ...(quote ? { discountCode: quote.code } : {}) },
      });
      router.push(`/account/orders/${order.id}`);
    } catch (err) {
      if (toLogin(err)) return;
      setError(err instanceof Error ? err.message : "ثبت سفارش ناموفق بود");
    } finally {
      setLoading(false);
    }
  }

  async function applyCode(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    setCodeError(null);
    try {
      setQuote(await apiFetch<Quote>("/checkout/quote", { method: "POST", body: { productId, discountCode: code.trim() } }));
    } catch (err) {
      if (toLogin(err)) return;
      setQuote(null);
      setCodeError(err instanceof Error ? err.message : "بررسی کد ممکن نشد.");
    } finally {
      setChecking(false);
    }
  }

  function removeCode() {
    setQuote(null);
    setCode("");
    setCodeError(null);
  }

  const free = quote !== null && quote.totalRial === 0;

  return (
    <div className="ds-stack-sm">
      {quote ? (
        <div className="buy-quote" role="status">
          <span className="buy-quote-line">
            <span>قیمت</span>
            <span className="tnum">{formatRial(quote.subtotalRial)}</span>
          </span>
          <span className="buy-quote-line">
            <span>
              تخفیف با کد <bdi dir="ltr">{quote.code}</bdi>
            </span>
            <span className="tnum buy-quote-off">{formatRial(quote.discountRial)}</span>
          </span>
          <span className="buy-quote-line buy-quote-total">
            <span>مبلغ نهایی</span>
            <b className="tnum">{free ? "رایگان" : formatRial(quote.totalRial)}</b>
          </span>
          <button type="button" className="buy-quote-remove" onClick={removeCode}>
            برداشتن کد
          </button>
        </div>
      ) : codeOpen ? (
        <form className="buy-code-row" onSubmit={applyCode}>
          <Input
            aria-label="کد تخفیف"
            dir="ltr"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="کد تخفیف"
            maxLength={40}
            autoComplete="off"
            autoFocus
          />
          <Button type="submit" loading={checking}>
            اعمال
          </Button>
        </form>
      ) : (
        <button type="button" className="buy-code-toggle" onClick={() => setCodeOpen(true)}>
          کد تخفیف داری؟
        </button>
      )}
      {codeError && <Alert tone="danger">{codeError}</Alert>}

      <div>
        <Button variant="primary" onClick={handleBuy} loading={loading}>
          {free ? "دریافت رایگان" : label}
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
