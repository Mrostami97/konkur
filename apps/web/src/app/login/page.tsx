"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { useAvailability } from "../../lib/availability";
import { TELEGRAM_URL } from "../../lib/site-nav";
import "./login.css";

/**
 * Persian and Arabic-Indic digits to ASCII, spaces and dashes removed. The
 * API then brings 09..., 989... and +989... to one form, so each spelling
 * of a number reaches the same account.
 */
function cleanPhone(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[\s-]/g, "");
}

function cleanCode(value: string) {
  return cleanPhone(value).replace(/\D/g, "").slice(0, 6);
}

/** The API's validation messages are English; say the same thing in Persian. */
function friendly(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : "";
  if (err instanceof ApiError && err.code === "OTP_COOLDOWN") {
    return `کد قبلی تازه فرستاده شده؛ ${toPersianDigits(Number(err.details?.retryAfterSeconds ?? 60))} ثانیهٔ دیگر می‌توانی کد تازه بگیری.`;
  }
  if (err instanceof ApiError && err.code === "OTP_HOURLY_LIMIT") return "برای این شماره کد زیادی درخواست شده؛ کمی بعد دوباره امتحان کن.";
  if (err instanceof ApiError && err.status === 429) return "تلاش‌ها زیاد بود؛ یک دقیقه صبر کن و دوباره امتحان کن.";
  if (/phone must be a valid phone number/i.test(message)) return "شمارهٔ موبایل را درست وارد کن؛ مثلاً ۰۹۱۲۳۴۵۶۷۸۹.";
  if (/code expired/i.test(message)) return "مهلت این کد تمام شده؛ کد تازه بگیر.";
  if (/too many attempts/i.test(message)) return "این کد چند بار اشتباه وارد شد؛ کد تازه بگیر.";
  if (/invalid phone or code/i.test(message)) return "کد واردشده درست نیست.";
  if (/invalid phone or password/i.test(message)) return "شماره یا رمز عبور درست نیست.";
  return message || fallback;
}

/** Where to land after signing in: a same-site path from `?next=`, never an
 * absolute or protocol-relative URL (that would make login an open redirect). */
function nextPath(): string {
  if (typeof window === "undefined") return "/account";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/account";
}

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);
  // Only a definite "no" closes the code form; until the flags arrive, or if
  // they cannot be read, the form stays usable.
  const otpClosed = useAvailability()?.otpLogin === false;

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ resendAfterSeconds?: number }>("/auth/otp/request", { method: "POST", body: { phone: cleanPhone(phone) } });
      setResendIn(res?.resendAfterSeconds || 60);
      setStep("code");
    } catch (err) {
      setError(friendly(err, "ارسال کد انجام نشد."));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/otp/verify", { method: "POST", body: { phone: cleanPhone(phone), code } });
      router.push(nextPath());
    } catch (err) {
      setError(friendly(err, "کد درست نیست یا منقضی شده است."));
    } finally {
      setLoading(false);
    }
  }

  async function loginWithPassword(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/password/login", { method: "POST", body: { phone: cleanPhone(phone), password } });
      router.push(nextPath());
    } catch (err) {
      setError(friendly(err, "ورود با رمز عبور انجام نشد."));
    } finally {
      setLoading(false);
    }
  }

  function switchMethod(next: "otp" | "password") {
    setMethod(next);
    setStep("phone");
    setError(null);
  }

  return (
    <main className="lg">
      <section className="lg-form-side" aria-labelledby="lg-title">
        <div className="lg-card">
          <h1 id="lg-title">ورود یا ثبت‌نام</h1>
          <p className="lg-sub">با شمارهٔ موبایلت وارد شو؛ اگر حساب نداری، همین‌جا ساخته می‌شود.</p>

          <div className="lg-tabs" role="tablist" aria-label="روش ورود">
            <button type="button" role="tab" aria-selected={method === "otp"} onClick={() => switchMethod("otp")}>
              کد یک‌بارمصرف{otpClosed && <span className="soon-pill">به‌زودی</span>}
            </button>
            <button type="button" role="tab" aria-selected={method === "password"} onClick={() => switchMethod("password")}>
              رمز عبور
            </button>
          </div>

          {method === "password" ? (
            <form onSubmit={loginWithPassword} className="lg-form">
              <label className="lg-field">
                <span>شمارهٔ موبایل</span>
                <input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912 345 6789" />
              </label>
              <label className="lg-field">
                <span>رمز عبور</span>
                <input type="password" autoComplete="current-password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <button className="lg-submit" type="submit" disabled={loading}>{loading ? "در حال ورود…" : "ورود"}</button>
              <p className="lg-hint">ورود با رمز فعلاً برای کادر آموزشی است.</p>
            </form>
          ) : otpClosed ? (
            <div className="login-soon">
              <span className="soon-pill">به‌زودی</span>
              <strong>ورود و ثبت‌نام با پیامک به‌زودی فعال می‌شود</strong>
              <p>
                سرویس پیامک سایت هنوز راه‌اندازی نشده، پس کد ورود به گوشی کسی نمی‌رسد. زمان راه‌اندازی در کانال
                تلگرام اعلام می‌شود.
              </p>
              <a className="lg-submit" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">کانال تلگرام @konkurcom</a>
            </div>
          ) : step === "phone" ? (
            <form onSubmit={requestCode} className="lg-form">
              <label className="lg-field">
                <span>شمارهٔ موبایل</span>
                <input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912 345 6789" />
              </label>
              <button className="lg-submit" type="submit" disabled={loading}>{loading ? "در حال ارسال…" : "دریافت کد"}</button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="lg-form">
              <p className="lg-sent">
                کد ۶ رقمی به <b dir="ltr">{cleanPhone(phone)}</b> فرستاده شد.{" "}
                <button type="button" className="lg-link" onClick={() => { setStep("phone"); setCode(""); }}>ویرایش شماره</button>
              </p>
              <label className="lg-field">
                <span>کد تأیید</span>
                <input
                  className="lg-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  dir="ltr"
                  required
                  value={code}
                  onChange={(e) => setCode(cleanCode(e.target.value))}
                  maxLength={6}
                  autoFocus
                />
              </label>
              <button className="lg-submit" type="submit" disabled={loading || code.length < 6}>{loading ? "در حال بررسی…" : "ورود"}</button>
              <p className="lg-hint">
                {resendIn > 0 ? (
                  <>ارسال دوبارهٔ کد تا {toPersianDigits(resendIn)} ثانیهٔ دیگر</>
                ) : (
                  <button type="button" className="lg-link" onClick={() => void requestCode()} disabled={loading}>کد نرسید؟ ارسال دوباره</button>
                )}
              </p>
            </form>
          )}

          {error && <p className="lg-error" role="alert">{error}</p>}
        </div>
      </section>

      <aside className="lg-side" aria-label="با حساب کاربری">
        <p className="lg-side-kicker">کنکورصفریک</p>
        <h2>یک جا برای برنامه، تمرین و نتیجه</h2>
        <ul>
          <li><b>برنامهٔ امروز</b><span>کار هر روز، کوتاه و مشخص</span></li>
          <li><b>آزمون و کارنامه</b><span>درصد به روش کنکور و رتبه بین شرکت‌کننده‌ها</span></li>
          <li><b>دوره‌ها و جزوه‌ها</b><span>هر چه تهیه کرده‌ای، در پنل خودت</span></li>
        </ul>
        <p className="lg-side-foot">
          هنوز مطمئن نیستی؟ <Link href="/articles/study-plan-from-zero">راهنمای شروع از صفر</Link> را بخوان.
        </p>
      </aside>
    </main>
  );
}
