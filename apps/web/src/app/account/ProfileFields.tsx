"use client";

import { useId, type ReactNode } from "react";
import { toEnglishDigits } from "../../lib/format";
import {
  EDUCATION_OPTIONS,
  ENTRY_YEARS,
  FIELD_SUGGESTIONS,
  GRADUATION_YEARS,
  LEVELS,
  TARGET_DEGREES,
  TARGET_EXAM_YEARS,
  TARGET_FIELDS,
  UNIVERSITY_SUGGESTIONS,
  type EducationStatus,
} from "./profile-options";
import type { StudentProfile } from "./student-context";

export interface ProfileForm {
  firstName: string;
  lastName: string;
  educationStatus: EducationStatus | "";
  universityName: string;
  fieldOfStudy: string;
  entryYear: string;
  graduationYear: string;
  gpa: string;
  targetDegree: "MASTER" | "PHD" | "";
  targetField: string;
  targetExamYear: string;
}

export interface GoalForm {
  weeklyHours: number;
  selfReportedLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "";
}

export type ProfileErrors = Partial<Record<keyof ProfileForm, string>>;
export type SetField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => void;

export function formFromProfile(profile: StudentProfile): ProfileForm {
  return {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    educationStatus: profile.educationStatus ?? "",
    universityName: profile.universityName ?? "",
    fieldOfStudy: profile.fieldOfStudy ?? "",
    entryYear: profile.entryYear ? String(profile.entryYear) : "",
    graduationYear: profile.graduationYear ? String(profile.graduationYear) : "",
    gpa: profile.gpa !== null && profile.gpa !== undefined ? String(profile.gpa) : "",
    targetDegree: profile.targetDegree ?? "",
    targetField: profile.targetField ?? "",
    targetExamYear: profile.targetExamYear ? String(profile.targetExamYear) : "",
  };
}

const PERSON_NAME = /^[\p{L}\p{M}\s‌'-]+$/u;

/** "17٫25", "۱۷.۲۵" and "17/25" all mean 17.25. */
function parseGpa(value: string) {
  return Number(toEnglishDigits(value.trim()).replace(/[٫/,]/, "."));
}

export type ProfileSection = "identity" | "education" | "target";

/** Mirrors the API's checks, so a mistake shows next to its field instead of
 * as a failed save. The API validates again regardless. */
export function validateSection(form: ProfileForm, section: ProfileSection): ProfileErrors {
  const errors: ProfileErrors = {};
  if (section === "identity") {
    for (const key of ["firstName", "lastName"] as const) {
      const value = form[key].trim();
      if (value.length < 2) errors[key] = "دست‌کم دو حرف بنویس.";
      else if (!PERSON_NAME.test(value)) errors[key] = "فقط حروف؛ بدون عدد یا نشانه.";
    }
  }
  if (section === "education") {
    if (!form.educationStatus) errors.educationStatus = "وضعیت تحصیلی‌ات را انتخاب کن.";
    if (form.universityName.trim().length < 2) errors.universityName = "نام دانشگاه را بنویس.";
    if (form.fieldOfStudy.trim().length < 2) errors.fieldOfStudy = "رشتهٔ تحصیلی‌ات را بنویس.";
    if (form.gpa.trim()) {
      const gpa = parseGpa(form.gpa);
      if (!Number.isFinite(gpa) || gpa < 0 || gpa > 20) errors.gpa = "معدل باید بین ۰ و ۲۰ باشد.";
      // 17.1 * 100 is 1710.0000000000002 in floating point, so compare with a tolerance.
      else if (Math.abs(Math.round(gpa * 100) - gpa * 100) > 1e-6) errors.gpa = "حداکثر دو رقم اعشار.";
    }
    if (form.entryYear && form.graduationYear && Number(form.graduationYear) < Number(form.entryYear)) {
      errors.graduationYear = "سال فارغ‌التحصیلی نمی‌تواند قبل از سال ورود باشد.";
    }
  }
  if (section === "target") {
    if (!form.targetDegree) errors.targetDegree = "مقطع هدف را انتخاب کن.";
    if (!form.targetField) errors.targetField = "رشتهٔ هدف را انتخاب کن.";
  }
  return errors;
}

/** The PATCH body for one section; empty optional answers are cleared. */
export function bodyForSection(form: ProfileForm, section: ProfileSection) {
  if (section === "identity") return { firstName: form.firstName.trim(), lastName: form.lastName.trim() };
  if (section === "education") {
    const gpa = form.gpa.trim() ? parseGpa(form.gpa) : null;
    return {
      educationStatus: form.educationStatus || undefined,
      universityName: form.universityName.trim(),
      fieldOfStudy: form.fieldOfStudy.trim(),
      entryYear: form.entryYear ? Number(form.entryYear) : null,
      graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
      gpa,
    };
  }
  return {
    targetDegree: form.targetDegree || undefined,
    targetField: form.targetField || undefined,
    targetExamYear: form.targetExamYear ? Number(form.targetExamYear) : null,
  };
}

// --- building blocks ------------------------------------------------------

function StField({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="st-field">
      <label className="st-label" htmlFor={id}>
        {label}
        {optional && <small>اختیاری</small>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p className="st-field-error" id={`${id}-error`}>{error}</p>
      ) : hint ? (
        <p className="st-field-hint" id={`${id}-hint`}>{hint}</p>
      ) : null}
    </div>
  );
}

export function ChoiceTiles<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  error,
  columns = 2,
}: {
  label: string;
  name: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T | "";
  onChange: (value: T) => void;
  error?: string;
  columns?: number;
}) {
  return (
    <fieldset className="st-field st-tiles-field">
      <legend className="st-label">{label}</legend>
      <div className="st-tiles" style={{ ["--cols" as string]: columns }} role="radiogroup">
        {options.map((option) => (
          <label key={option.value} className={`st-tile${value === option.value ? " st-tile-on" : ""}`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="st-tile-check" aria-hidden />
            <strong>{option.label}</strong>
            {option.hint && <small>{option.hint}</small>}
          </label>
        ))}
      </div>
      {error && <p className="st-field-error">{error}</p>}
    </fieldset>
  );
}

// --- sections -------------------------------------------------------------

export function IdentityFields({ form, set, errors }: { form: ProfileForm; set: SetField; errors: ProfileErrors }) {
  return (
    <div className="st-grid-2">
      <StField label="نام" error={errors.firstName}>
        {(props) => (
          <input {...props} className="st-input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" maxLength={40} />
        )}
      </StField>
      <StField label="نام خانوادگی" error={errors.lastName}>
        {(props) => (
          <input {...props} className="st-input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" maxLength={60} />
        )}
      </StField>
    </div>
  );
}

export function EducationFields({ form, set, errors }: { form: ProfileForm; set: SetField; errors: ProfileErrors }) {
  const listId = useId();
  return (
    <div className="st-stack">
      <ChoiceTiles
        label="وضعیت تحصیلی"
        name="educationStatus"
        options={EDUCATION_OPTIONS}
        value={form.educationStatus}
        onChange={(value) => set("educationStatus", value)}
        error={errors.educationStatus}
        columns={3}
      />
      <div className="st-grid-2">
        <StField label="دانشگاه" hint="دانشگاهی که مدرک آخرت را از آن گرفته‌ای یا در آن درس می‌خوانی" error={errors.universityName}>
          {(props) => (
            <>
              <input {...props} className="st-input" list={`${listId}-uni`} value={form.universityName} onChange={(e) => set("universityName", e.target.value)} maxLength={120} />
              <datalist id={`${listId}-uni`}>
                {UNIVERSITY_SUGGESTIONS.map((name) => <option key={name} value={name} />)}
              </datalist>
            </>
          )}
        </StField>
        <StField label="رشتهٔ تحصیلی" error={errors.fieldOfStudy}>
          {(props) => (
            <>
              <input {...props} className="st-input" list={`${listId}-field`} value={form.fieldOfStudy} onChange={(e) => set("fieldOfStudy", e.target.value)} maxLength={120} />
              <datalist id={`${listId}-field`}>
                {FIELD_SUGGESTIONS.map((name) => <option key={name} value={name} />)}
              </datalist>
            </>
          )}
        </StField>
      </div>
      <div className="st-grid-3">
        <StField label="سال ورود" optional error={errors.entryYear}>
          {(props) => (
            <select {...props} className="st-input" value={form.entryYear} onChange={(e) => set("entryYear", e.target.value)}>
              <option value="">انتخاب کن</option>
              {ENTRY_YEARS.map((year) => <option key={year} value={year}>{year.toLocaleString("fa-IR", { useGrouping: false })}</option>)}
            </select>
          )}
        </StField>
        <StField label="سال فارغ‌التحصیلی" optional hint="یا سالی که انتظارش را داری" error={errors.graduationYear}>
          {(props) => (
            <select {...props} className="st-input" value={form.graduationYear} onChange={(e) => set("graduationYear", e.target.value)}>
              <option value="">انتخاب کن</option>
              {GRADUATION_YEARS.map((year) => (
                <option key={year} value={year}>{year.toLocaleString("fa-IR", { useGrouping: false })}</option>
              ))}
            </select>
          )}
        </StField>
        <StField label="معدل" optional hint="از ۲۰؛ مثلاً ۱۷٫۲۵" error={errors.gpa}>
          {(props) => (
            <input {...props} className="st-input" inputMode="decimal" dir="ltr" value={form.gpa} onChange={(e) => set("gpa", e.target.value)} maxLength={5} />
          )}
        </StField>
      </div>
    </div>
  );
}

export function TargetFields({ form, set, errors }: { form: ProfileForm; set: SetField; errors: ProfileErrors }) {
  return (
    <div className="st-stack">
      <ChoiceTiles
        label="برای کدام کنکور می‌خوانی؟"
        name="targetDegree"
        options={TARGET_DEGREES}
        value={form.targetDegree}
        onChange={(value) => set("targetDegree", value)}
        error={errors.targetDegree}
      />
      <ChoiceTiles
        label="رشتهٔ هدف"
        name="targetField"
        options={TARGET_FIELDS.map((field) => ({ value: field.value, label: field.label, hint: field.code }))}
        value={form.targetField as (typeof TARGET_FIELDS)[number]["value"] | ""}
        onChange={(value) => set("targetField", value)}
        error={errors.targetField}
        columns={3}
      />
      <ChoiceTiles
        label="سال کنکور"
        name="targetExamYear"
        options={TARGET_EXAM_YEARS.map((year) => ({ value: String(year), label: `کنکور ${year.toLocaleString("fa-IR", { useGrouping: false })}` }))}
        value={form.targetExamYear}
        onChange={(value) => set("targetExamYear", value)}
        columns={3}
      />
    </div>
  );
}

export function GoalFields({ goal, setGoal }: { goal: GoalForm; setGoal: (goal: GoalForm) => void }) {
  const id = useId();
  return (
    <div className="st-stack">
      <div className="st-field">
        <label className="st-label" htmlFor={id}>
          هفته‌ای چند ساعت می‌توانی درس بخوانی؟
          <b className="st-range-value">{goal.weeklyHours.toLocaleString("fa-IR")} ساعت</b>
        </label>
        <input
          id={id}
          type="range"
          className="st-range"
          min={3}
          max={60}
          step={1}
          value={goal.weeklyHours}
          onChange={(e) => setGoal({ ...goal, weeklyHours: Number(e.target.value) })}
        />
        <p className="st-field-hint">برنامهٔ مطالعه از همین عدد شروع می‌شود و با کار واقعی‌ات کم‌کم بیشتر می‌شود.</p>
      </div>
      <ChoiceTiles
        label="الان کجای مسیری؟"
        name="selfReportedLevel"
        options={LEVELS}
        value={goal.selfReportedLevel}
        onChange={(value) => setGoal({ ...goal, selfReportedLevel: value })}
        columns={3}
      />
    </div>
  );
}
