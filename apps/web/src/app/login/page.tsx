"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useAvailability } from "../../lib/availability";
import { TELEGRAM_URL } from "../../lib/site-nav";
import "./login.css";

/**
 * Persian and Arabic-Indic digits to ASCII, spaces and dashes removed. The
 * account key is the number exactly as typed otherwise -- 09... and +989...
 * are different accounts on the API -- so no country-code rewriting here.
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

/**
 * Where to go after signing in: the ?next= page the visitor came from, but
 * only a path on this site -- never another host, which would make the
 * login page a redirect anyone could point elsewhere.
 */
function afterLogin() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  return /^\/(?![/\\])/.test(next) ? next : "/account";
}

/** The API's validation messages are English; say the same thing in Persian. */
function friendly(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : "";
  if (/phone must be a valid phone number/i.test(message)) return "شمارهٔ موبایل را درست وارد کن؛ مثلاً ۰۹۱۲۳۴۵۶۷۸۹.";
  return message || fallback;
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
  // Only a definite "no" closes the code form; until the flags arrive, or if
  // they cannot be read, the form stays usable.
  const otpClosed = useAvailability()?.otpLogin === false;

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/otp/request", { method: "POST", body: { phone: cleanPhone(phone) } });
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
      router.push(afterLogin());
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
      router.push(afterLogin());
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
              <a className="lg-submit" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">کانال تلگرام @kunkurcomputer</a>
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
            </form>
          )}

          {error && <p className="lg-error" role="alert">{error}</p>}
        </div>
      </section>

      <aside className="lg-side" aria-label="با حساب کاربری">
        <p className="lg-side-kicker">کنکور کامپیوتر</p>
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
