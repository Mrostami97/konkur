"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Glyph } from "../../components/SubjectIcon";
import { apiFetch, ApiError } from "../../lib/api";
import { EXAM_DATES } from "../../lib/exam-dates";
import { toPersianDigits } from "../../lib/format";
import {
  bodyForSection,
  EducationFields,
  formFromProfile,
  GoalFields,
  IdentityFields,
  TargetFields,
  validateSection,
  type GoalForm,
  type ProfileErrors,
  type ProfileForm,
  type ProfileSection,
} from "./ProfileFields";
import { useStudent, type StudentProfile } from "./student-context";

const STEPS: { section: ProfileSection; title: string; lead: string; label: string }[] = [
  {
    section: "identity",
    label: "معرفی",
    title: "اسمت را بنویس",
    lead: "همان‌طور که می‌خواهی روی کارنامهٔ آزمون‌ها و گواهی دوره‌هایت بیاید.",
  },
  {
    section: "education",
    label: "سوابق تحصیلی",
    title: "کجا و چه رشته‌ای خوانده‌ای؟",
    lead: "با این اطلاعات، مسیر، منبع و آزمون‌هایی که به سابقهٔ خودت می‌خورد را پیشنهاد می‌کنیم.",
  },
  {
    section: "target",
    label: "هدف کنکور",
    title: "برای کدام کنکور آماده می‌شوی؟",
    lead: "برنامهٔ مطالعه، روزشمار و آزمون‌ها بر اساس همین هدف چیده می‌شوند. هر وقت خواستی عوضش کن.",
  },
];

function firstOpenStep(profile: StudentProfile) {
  const missing = new Set(profile.completion.missing);
  if (missing.has("firstName") || missing.has("lastName")) return 0;
  if (["educationStatus", "universityName", "fieldOfStudy"].some((field) => missing.has(field))) return 1;
  return 2;
}

/** The exam date the goal counts toward, when the chosen year has one on file. */
function goalExamDate(form: ProfileForm) {
  if (form.targetExamYear !== "1406") return undefined;
  return form.targetDegree === "PHD" ? EXAM_DATES.phd1406.iso : EXAM_DATES.master1406.iso;
}

/**
 * First-run setup, shown instead of the panel until the required profile
 * fields are filled in. Three short steps, each saved as the student leaves
 * it, so closing the tab halfway loses nothing and the next visit resumes at
 * the first unanswered step.
 */
export function Onboarding() {
  const router = useRouter();
  const { me, profile, setProfile } = useStudent();
  const [step, setStep] = useState(() => firstOpenStep(profile));
  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile));
  const [goal, setGoal] = useState<GoalForm>({ weeklyHours: 14, selfReportedLevel: "" });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ weeklyHours: number; selfReportedLevel: string }>("/me/goal")
      .then((existing) =>
        setGoal({
          weeklyHours: existing.weeklyHours,
          selfReportedLevel: ["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(existing.selfReportedLevel)
            ? (existing.selfReportedLevel as GoalForm["selfReportedLevel"])
            : "",
        }),
      )
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  async function next() {
    const found = validateSection(form, current.section);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setFailure(null);
    try {
      const updated = await apiFetch<StudentProfile>("/me/profile", {
        method: "PATCH",
        body: bodyForSection(form, current.section),
      });
      if (current.section === "target") {
        await apiFetch("/me/goal", {
          method: "PUT",
          body: {
            degree: form.targetDegree,
            field: form.targetField,
            weeklyHours: goal.weeklyHours,
            ...(goal.selfReportedLevel ? { selfReportedLevel: goal.selfReportedLevel } : {}),
            ...(goalExamDate(form) ? { targetExamDate: goalExamDate(form) } : {}),
          },
        });
      }
      window.scrollTo({ top: 0 });
      // Once the profile is complete, swapping it into context lifts the gate
      // and the shell shows the panel; until then, on to the next step.
      setProfile(updated);
      if (updated.completion.complete) return;
      if (!last) {
        setStep(step + 1);
      } else {
        setStep(firstOpenStep(updated));
        setFailure("یکی از مرحله‌های قبل هنوز کامل نیست؛ آن را تکمیل کن.");
      }
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.status === 400
          ? "بعضی از پاسخ‌ها قابل ذخیره نبود؛ مقدارها را یک بار دیگر بررسی کن."
          : "ذخیره انجام نشد. اتصال را بررسی کن و دوباره امتحان کن.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/");
  }

  return (
    <div className="ob">
      <aside className="ob-side">
        <div className="ob-brand">
          <Image src="/brand/logo-128.webp" alt="" width={44} height={44} unoptimized />
          <strong>کنکور کامپیوتر</strong>
        </div>
        <h2>خوش آمدی! چند سؤال کوتاه و پنلت آماده است.</h2>
        <ol className="ob-steps">
          {STEPS.map((item, index) => (
            <li key={item.section} data-state={index < step ? "done" : index === step ? "current" : "next"}>
              <span className="ob-step-dot">
                {index < step ? <Glyph name="shield" /> : toPersianDigits(index + 1)}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ol>
        <ul className="ob-perks">
          <li><Glyph name="target" /> آزمون‌های زمان‌دار با کارنامهٔ به نام خودت</li>
          <li><Glyph name="calendar" /> برنامهٔ مطالعه‌ای که با کار واقعی‌ات تنظیم می‌شود</li>
          <li><Glyph name="trophy" /> پیشرفت دوره‌ها و مباحث ضعیف، یک‌جا</li>
        </ul>
        <p className="ob-privacy">
          این اطلاعات فقط برای خودت و کارنامه‌هایت استفاده می‌شود و هیچ‌جا عمومی نمایش داده نمی‌شود.
        </p>
      </aside>

      <main className="ob-main">
        <div className="ob-card">
          <div className="ob-progress" aria-hidden>
            <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <p className="ob-kicker">
            مرحلهٔ {toPersianDigits(step + 1)} از {toPersianDigits(STEPS.length)}
          </p>
          <h1>{current.title}</h1>
          <p className="ob-lead">{current.lead}</p>

          <form
            className="ob-form"
            onSubmit={(event) => {
              event.preventDefault();
              void next();
            }}
            noValidate
          >
            {current.section === "identity" && <IdentityFields form={form} set={set} errors={errors} />}
            {current.section === "education" && <EducationFields form={form} set={set} errors={errors} />}
            {current.section === "target" && (
              <>
                <TargetFields form={form} set={set} errors={errors} />
                <GoalFields goal={goal} setGoal={setGoal} />
              </>
            )}

            {failure && <p className="st-alert st-alert-danger" role="alert">{failure}</p>}

            <div className="ob-actions">
              {step > 0 ? (
                <button type="button" className="st-btn st-btn-ghost" onClick={() => setStep(step - 1)} disabled={saving}>
                  مرحلهٔ قبل
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className="st-btn st-btn-primary st-btn-lg" disabled={saving}>
                {saving ? "در حال ذخیره…" : last ? "ورود به پنل" : "ادامه"}
                {!saving && <span aria-hidden>←</span>}
              </button>
            </div>
          </form>
        </div>
        <p className="ob-foot">
          وارد شده با <bdi dir="ltr">{toPersianDigits(me.user.phone)}</bdi>
          <span aria-hidden> · </span>
          <button type="button" onClick={() => void logout()}>خروج</button>
        </p>
      </main>
    </div>
  );
}
