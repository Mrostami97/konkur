"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/otp/request", { method: "POST", body: { phone } });
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ارسال کد");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/otp/verify", { method: "POST", body: { phone, code } });
      router.push("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "کد نامعتبر است");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithPassword(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/password/login", { method: "POST", body: { phone, password } });
      router.push("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ورود با رمز عبور ناموفق بود");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 420, margin: "0 auto" }}>
      <h1>ورود</h1>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button type="button" onClick={() => { setMethod("otp"); setStep("phone"); }} disabled={method === "otp"}>
          ورود با کد یک‌بارمصرف
        </button>
        <button type="button" onClick={() => setMethod("password")} disabled={method === "password"}>
          ورود با رمز عبور
        </button>
      </div>
      {method === "password" ? (
        <form onSubmit={loginWithPassword}>
          <label>
            شماره موبایل
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+989120000000"
              style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.3rem" }}
            />
          </label>
          <label style={{ display: "block", marginTop: "1rem" }}>
            رمز عبور
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.3rem" }}
            />
          </label>
          <button type="submit" disabled={loading} style={{ marginTop: "1rem" }}>
            ورود
          </button>
        </form>
      ) : step === "phone" ? (
        <form onSubmit={requestCode}>
          <label>
            شماره موبایل
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+989120000000"
              style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.3rem" }}
            />
          </label>
          <button type="submit" disabled={loading} style={{ marginTop: "1rem" }}>
            دریافت کد
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <p>کد ۶ رقمی ارسال‌شده را وارد کنید (در محیط توسعه، در لاگ سرور API چاپ می‌شود).</p>
          <label>
            کد تأیید
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.3rem" }}
            />
          </label>
          <button type="submit" disabled={loading} style={{ marginTop: "1rem" }}>
            ورود
          </button>
        </form>
      )}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}
