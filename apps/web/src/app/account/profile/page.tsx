"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Glyph, type GlyphName } from "../../../components/SubjectIcon";
import { apiFetch } from "../../../lib/api";
import { EXAM_DATES } from "../../../lib/exam-dates";
import { toPersianDigits } from "../../../lib/format";
import { AccountShell } from "../AccountShell";
import { MyVideoLicense } from "../MyVideoLicense";
import { ProgressRing } from "../charts";
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
} from "../ProfileFields";
import { degreeLabel, educationLabel, fieldLabel, REQUIRED_FIELD_LABELS } from "../profile-options";
import { initials, studentName, useStudent, type StudentProfile } from "../student-context";

/** A same-site path to go back to after completing the profile, e.g. the
 * exam that sent the student here. Anything else is ignored. */
function safeNext(): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function SectionCard({
  icon,
  title,
  lead,
  saved,
  error,
  saving,
  onSubmit,
  children,
}: {
  icon: GlyphName;
  title: string;
  lead: string;
  saved: boolean;
  error: string | null;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <section className="st-card st-form-card">
      <header className="st-card-head">
        <h2>
          <span className="st-card-icon"><Glyph name={icon} /></span>
          {title}
        </h2>
      </header>
      <p className="st-card-lead">{lead}</p>
      <form onSubmit={onSubmit} noValidate className="st-stack">
        {children}
        {error && <p className="st-alert st-alert-danger" role="alert">{error}</p>}
        <div className="st-form-actions">
          {saved && !error && <span className="st-saved"><Glyph name="shield" /> ذخیره شد</span>}
          <button type="submit" className="st-btn st-btn-primary" disabled={saving}>
            {saving ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function ProfilePage() {
  const { me, profile, setProfile } = useStudent();
  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile));
  const [goal, setGoal] = useState<GoalForm>({ weeklyHours: 14, selfReportedLevel: "" });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState<ProfileSection | null>(null);
  const [saved, setSaved] = useState<ProfileSection | null>(null);
  const [failure, setFailure] = useState<{ section: ProfileSection; message: string } | null>(null);
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    setNext(safeNext());
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
    setSaved(null);
  };

  function submit(section: ProfileSection) {
    return async (event: FormEvent) => {
      event.preventDefault();
      const found = validateSection(form, section);
      setErrors(found);
      if (Object.keys(found).length > 0) return;
      setSaving(section);
      setFailure(null);
      setSaved(null);
      try {
        const updated = await apiFetch<StudentProfile>("/me/profile", {
          method: "PATCH",
          body: bodyForSection(form, section),
        });
        if (section === "target" && form.targetDegree && form.targetField) {
          const examDate =
            form.targetExamYear === "1406"
              ? form.targetDegree === "PHD"
                ? EXAM_DATES.phd1406.iso
                : EXAM_DATES.master1406.iso
              : undefined;
          await apiFetch("/me/goal", {
            method: "PUT",
            body: {
              degree: form.targetDegree,
              field: form.targetField,
              weeklyHours: goal.weeklyHours,
              ...(goal.selfReportedLevel ? { selfReportedLevel: goal.selfReportedLevel } : {}),
              ...(examDate ? { targetExamDate: examDate } : {}),
            },
          });
        }
        setProfile(updated);
        setForm(formFromProfile(updated));
        setSaved(section);
      } catch {
        setFailure({ section, message: "ذخیره انجام نشد. مقدارها و اتصال را بررسی کن و دوباره امتحان کن." });
      } finally {
        setSaving(null);
      }
    };
  }

  const completion = profile.completion;

  return (
    <AccountShell
      title="پروفایل و اطلاعات تحصیلی"
      subtitle="این اطلاعات روی کارنامهٔ آزمون‌ها و برنامهٔ مطالعه‌ات استفاده می‌شود و هیچ‌جا عمومی نمایش داده نمی‌شود."
    >
      <section className="st-profile-hero">
        <span className="st-avatar st-avatar-xl">{initials(profile)}</span>
        <div className="st-profile-id">
          <h2>{studentName(profile)}</h2>
          <p dir="ltr" className="st-profile-phone">{toPersianDigits(me.user.phone)}</p>
          <div className="st-chips">
            <span className="st-chip">{educationLabel(profile.educationStatus)}</span>
            {profile.universityName && <span className="st-chip">{profile.universityName}</span>}
            {profile.targetDegree && (
              <span className="st-chip st-chip-accent">
                هدف: {degreeLabel(profile.targetDegree)} {fieldLabel(profile.targetField)}
                {profile.targetExamYear ? ` ${toPersianDigits(profile.targetExamYear)}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="st-profile-ring">
          <ProgressRing percent={completion.percent} size={104} stroke={10} tone={completion.complete ? "teal" : "amber"} label="تکمیل" />
        </div>
      </section>

      {!completion.complete ? (
        <div className="st-alert st-alert-warn">
          <strong>برای شرکت در آزمون‌ها این موارد لازم است:</strong>{" "}
          {completion.missing.map((field) => REQUIRED_FIELD_LABELS[field] ?? field).join("، ")}
        </div>
      ) : next ? (
        <div className="st-alert st-alert-success st-row-between">
          <span>پروفایلت کامل است و می‌توانی آزمون را شروع کنی.</span>
          <Link href={next} className="st-btn st-btn-primary st-btn-sm">برگشت به آزمون</Link>
        </div>
      ) : null}

      <MyVideoLicense />

      <SectionCard
        icon="shield"
        title="اطلاعات فردی"
        lead="همان‌طور بنویس که می‌خواهی روی کارنامه و گواهی‌هایت بیاید."
        saved={saved === "identity"}
        saving={saving === "identity"}
        error={failure?.section === "identity" ? failure.message : null}
        onSubmit={submit("identity")}
      >
        <IdentityFields form={form} set={set} errors={errors} />
        <p className="st-field-hint">شمارهٔ موبایل شناسهٔ ورود توست و از اینجا عوض نمی‌شود.</p>
      </SectionCard>

      <SectionCard
        icon="building"
        title="اطلاعات تحصیلی"
        lead="وضعیت تحصیلی، دانشگاه و رشته‌ات؛ برای پیشنهاد مسیر و منابع متناسب با سابقه‌ات."
        saved={saved === "education"}
        saving={saving === "education"}
        error={failure?.section === "education" ? failure.message : null}
        onSubmit={submit("education")}
      >
        <EducationFields form={form} set={set} errors={errors} />
      </SectionCard>

      <SectionCard
        icon="target"
        title="هدف کنکور و برنامه"
        lead="روزشمار، برنامهٔ مطالعه و آزمون‌های پیشنهادی بر اساس همین هدف چیده می‌شوند."
        saved={saved === "target"}
        saving={saving === "target"}
        error={failure?.section === "target" ? failure.message : null}
        onSubmit={submit("target")}
      >
        <TargetFields form={form} set={set} errors={errors} />
        <GoalFields goal={goal} setGoal={(value) => { setGoal(value); setSaved(null); }} />
      </SectionCard>
    </AccountShell>
  );
}
