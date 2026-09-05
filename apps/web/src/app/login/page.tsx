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
    <main className="login-shell">
      <section className="login-pitch">
        <span className="eyebrow">ورود به مسیر شخصی تو</span>
        <h1>آماده‌ای امروز کمی بهتر از دیروز باشی؟</h1>
        <p>با ورود به حساب، برنامه روزانه، دوره‌ها، آزمون‌ها و گزارش پیشرفتت همیشه همراهت هستند.</p>
        <ul className="login-points">
          <li>برنامه و هدف‌های شخصی‌سازی‌شده</li>
          <li>ثبت روند مطالعه و آزمون‌ها</li>
          <li>تحلیل روشن برای تصمیم بهتر</li>
        </ul>
      </section>
      <section className="login-card">
        <h2>خوش آمدی 👋</h2>
        <p>یکی از روش‌های ورود را انتخاب کن.</p>
        <div className="method-switch">
          <button className={method === "otp" ? "active" : ""} type="button" onClick={() => { setMethod("otp"); setStep("phone"); }}>
          ورود با کد یک‌بارمصرف
          </button>
          <button className={method === "password" ? "active" : ""} type="button" onClick={() => setMethod("password")}>
          ورود با رمز عبور
          </button>
        </div>
      {method === "password" ? (
        <form onSubmit={loginWithPassword}>
          <div className="form-group"><label htmlFor="password-phone">شماره موبایل</label>
            <input
              id="password-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+989120000000"
            />
          </div>
          <div className="form-group"><label htmlFor="password">رمز عبور</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="button button-primary form-submit" type="submit" disabled={loading}>
            ورود
          </button>
        </form>
      ) : step === "phone" ? (
        <form onSubmit={requestCode}>
          <div className="form-group"><label htmlFor="otp-phone">شماره موبایل</label>
            <input
              id="otp-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+989120000000"
            />
          </div>
          <button className="button button-primary form-submit" type="submit" disabled={loading}>
            دریافت کد
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <p className="form-hint">کد ۶ رقمی ارسال‌شده را وارد کنید (در محیط توسعه، در لاگ سرور API چاپ می‌شود).</p>
          <div className="form-group"><label htmlFor="otp-code">کد تأیید</label>
            <input
              id="otp-code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
            />
          </div>
          <button className="button button-primary form-submit" type="submit" disabled={loading}>
            ورود
          </button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
      </section>
    </main>
  );
}
