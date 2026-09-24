"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { toEnglishDigits, toPersianDigits } from "../../lib/format";

/** Where to land after signing in: a same-site path from `?next=`, never an
 * absolute or protocol-relative URL (that would make login an open redirect). */
function nextPath(): string {
  if (typeof window === "undefined") return "/account";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/account";
}

/** 09121234567 -> ۰۹۱۲•••۴۵۶۷, so the person can check the number without
 * the whole of it sitting on screen. */
function maskedPhone(phone: string): string {
  const local = phone.startsWith("+98") ? `0${phone.slice(3)}` : phone;
  return toPersianDigits(local.length >= 8 ? `${local.slice(0, 4)}•••${local.slice(-4)}` : local);
}

/** The API answers in English for developers; the person reads Persian. */
function explain(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return "اتصال برقرار نشد؛ اینترنتت را بررسی کن و دوباره امتحان کن.";
  if (err.code === "OTP_COOLDOWN" || err.code === "OTP_HOURLY_LIMIT") {
    const seconds = Number(err.details?.retryAfterSeconds ?? 60);
    return err.code === "OTP_COOLDOWN"
      ? `کد قبلی تازه فرستاده شده؛ ${toPersianDigits(seconds)} ثانیهٔ دیگر می‌توانی کد تازه بگیری.`
      : `برای این شماره کد زیادی درخواست شده؛ حدود ${toPersianDigits(Math.ceil(seconds / 60))} دقیقهٔ دیگر دوباره امتحان کن.`;
  }
  if (err.status === 429) return "تعداد تلاش‌ها زیاد بود؛ یک دقیقه صبر کن و دوباره امتحان کن.";
  if (err.status === 503) return "فرستادن پیامک الان ممکن نشد؛ چند دقیقهٔ دیگر دوباره امتحان کن.";
  if (err.message.includes("expired")) return "مهلت این کد تمام شده؛ کد تازه بگیر.";
  if (err.message.includes("too many attempts")) return "این کد چند بار اشتباه وارد شد؛ کد تازه بگیر.";
  if (err.message.includes("invalid phone or password")) return "شماره یا رمز عبور درست نیست.";
  if (err.message.includes("invalid phone or code")) return "کد واردشده درست نیست.";
  if (err.message.includes("phone must be")) return "شمارهٔ موبایل را کامل وارد کن، مثل ۰۹۱۲۱۲۳۴۵۶۷.";
  return fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ phone: string; resendAfterSeconds: number }>("/auth/otp/request", {
        method: "POST",
        body: { phone: toEnglishDigits(phone) },
      });
      setSentTo(res.phone);
      setResendIn(res.resendAfterSeconds || 60);
      setCode("");
      setStep("code");
    } catch (err) {
      if (err instanceof ApiError && err.code === "OTP_COOLDOWN") {
        // A code is already on its way: go to the code step instead of
        // making the person wait on this screen.
        setSentTo(toEnglishDigits(phone));
        setResendIn(Number(err.details?.retryAfterSeconds ?? 60));
        setStep("code");
      }
      setError(explain(err, "فرستادن کد ممکن نشد؛ دوباره امتحان کن."));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/otp/verify", { method: "POST", body: { phone: sentTo || toEnglishDigits(phone), code: toEnglishDigits(code) } });
      router.push(nextPath());
    } catch (err) {
      setError(explain(err, "ورود ممکن نشد؛ دوباره امتحان کن."));
      setLoading(false);
    }
  }

  async function loginWithPassword(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/password/login", { method: "POST", body: { phone: toEnglishDigits(phone), password } });
      router.push(nextPath());
    } catch (err) {
      setError(explain(err, "ورود با رمز عبور ممکن نشد."));
      setLoading(false);
    }
  }

  function switchMethod(next: "otp" | "password") {
    setMethod(next);
    setStep("phone");
    setError(null);
  }

  return (
    <main className="login-shell">
      <section className="login-pitch">
        <span className="eyebrow">ورود یا ساختن حساب</span>
        <h1>با شمارهٔ موبایلت وارد شو</h1>
        <p>
          اگر اولین بار است، با همین کد حسابت ساخته می‌شود. آزمون‌ها، کارنامه، دوره‌ها و برنامهٔ مطالعه‌ات همه به همین شماره
          نگه داشته می‌شوند.
        </p>
        <ul className="login-points">
          <li>آزمون‌ساز و بانک سؤال با کارنامهٔ شخصی</li>
          <li>دوره‌ها و جلسه‌های مشاوره‌ای که خریده‌ای</li>
          <li>برنامهٔ امروز و روند پیشرفتت</li>
        </ul>
      </section>

      <section className="login-card" aria-labelledby="login-title">
        <h2 id="login-title">{step === "code" ? "کد تأیید را وارد کن" : "ورود / ثبت‌نام"}</h2>
        {step === "code" ? (
          <p>
            کد ۶ رقمی به <b dir="ltr">{maskedPhone(sentTo)}</b> پیامک شد.{" "}
            <button type="button" className="login-link" onClick={() => { setStep("phone"); setError(null); }}>
              ویرایش شماره
            </button>
          </p>
        ) : (
          <p>شمارهٔ موبایلت را وارد کن تا کد ورود برایت پیامک شود.</p>
        )}

        {step === "phone" && (
          <div className="method-switch" role="tablist" aria-label="روش ورود">
            <button role="tab" aria-selected={method === "otp"} className={method === "otp" ? "active" : ""} type="button" onClick={() => switchMethod("otp")}>
              با کد پیامکی
            </button>
            <button role="tab" aria-selected={method === "password"} className={method === "password" ? "active" : ""} type="button" onClick={() => switchMethod("password")}>
              با رمز عبور
            </button>
          </div>
        )}

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        {step === "code" ? (
          <form onSubmit={verifyCode} noValidate>
            <div className="form-group">
              <label htmlFor="otp-code">کد تأیید</label>
              <input
                ref={codeRef}
                id="otp-code"
                className="login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                value={toPersianDigits(code)}
                onChange={(event) => setCode(toEnglishDigits(event.target.value).replace(/\D/g, "").slice(0, 6))}
                placeholder="------"
                maxLength={6}
                required
              />
            </div>
            <button className="button button-primary form-submit" type="submit" disabled={loading || code.length !== 6}>
              {loading ? "در حال ورود…" : "ورود"}
            </button>
            <div className="login-resend">
              {resendIn > 0 ? (
                <span>ارسال دوبارهٔ کد تا {toPersianDigits(resendIn)} ثانیهٔ دیگر</span>
              ) : (
                <button type="button" className="login-link" onClick={() => requestCode()} disabled={loading}>
                  کد نرسید؟ ارسال دوباره
                </button>
              )}
            </div>
            {process.env.NODE_ENV !== "production" && (
              <p className="form-hint">محیط توسعه: اگر درگاه پیامک تنظیم نشده باشد، کد در لاگ سرور API چاپ می‌شود.</p>
            )}
          </form>
        ) : method === "password" ? (
          <form onSubmit={loginWithPassword} noValidate>
            <div className="form-group">
              <label htmlFor="password-phone">شمارهٔ موبایل</label>
              <input
                id="password-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                required
                value={toPersianDigits(phone)}
                onChange={(event) => setPhone(toEnglishDigits(event.target.value))}
                placeholder="۰۹۱۲۱۲۳۴۵۶۷"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">رمز عبور</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <button className="button button-primary form-submit" type="submit" disabled={loading || !phone || !password}>
              {loading ? "در حال ورود…" : "ورود"}
            </button>
            <p className="form-hint">رمز عبور فقط برای حساب‌هایی است که مدیر سایت برایشان رمز گذاشته؛ بقیه با کد پیامکی وارد می‌شوند.</p>
          </form>
        ) : (
          <form onSubmit={requestCode} noValidate>
            <div className="form-group">
              <label htmlFor="otp-phone">شمارهٔ موبایل</label>
              <input
                id="otp-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                required
                value={toPersianDigits(phone)}
                onChange={(event) => setPhone(toEnglishDigits(event.target.value))}
                placeholder="۰۹۱۲۱۲۳۴۵۶۷"
              />
            </div>
            <button className="button button-primary form-submit" type="submit" disabled={loading || phone.replace(/\D/g, "").length < 10}>
              {loading ? "در حال فرستادن…" : "دریافت کد ورود"}
            </button>
            <p className="form-hint">شماره‌ات فقط برای ورود و پیامک‌های مربوط به حساب خودت (مثل تأیید پرداخت) استفاده می‌شود.</p>
          </form>
        )}
      </section>
    </main>
  );
}
