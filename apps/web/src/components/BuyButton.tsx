"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiError } from "../lib/api";

export function BuyButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setState("loading");
    setError(null);
    try {
      await apiFetch("/checkout", { method: "POST", body: { productId } });
      router.push("/account");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      setState("error");
      setError(err instanceof Error ? err.message : "خرید ناموفق بود");
    }
  }

  return (
    <div>
      <button
        onClick={handleBuy}
        disabled={state === "loading"}
        style={{
          background: "#243B53",
          color: "white",
          border: "none",
          borderRadius: 6,
          padding: "0.6rem 1.2rem",
          cursor: "pointer",
        }}
      >
        {state === "loading" ? "در حال پردازش..." : "خرید دوره"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
