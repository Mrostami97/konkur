import { Transform } from "class-transformer";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Persian and Arabic-Indic digits to ASCII, e.g. a code typed on a Persian
 * keyboard. */
export function latinDigits(raw: string): string {
  return String(raw ?? "")
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

/**
 * One account per mobile number, however it is typed. Iranian users write
 * the same number as 09121234567, 9121234567, 989121234567, +98 912 123 4567
 * or with Persian digits; before this, each spelling silently became a
 * separate account with its own purchases. Iranian mobiles are stored as
 * +989XXXXXXXXX; anything else is only cleaned of separators, so a foreign
 * number still works.
 */
export function normalizePhone(raw: string): string {
  let value = latinDigits(raw).replace(/[\s\-().\u200c\u200e\u200f]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (/^09\d{9}$/.test(value)) return `+98${value.slice(1)}`;
  if (/^9\d{9}$/.test(value)) return `+98${value}`;
  if (/^98\d{10}$/.test(value)) return `+${value}`;
  return value;
}

/** Normalizes a DTO's phone field before validation runs. */
export const NormalizePhone = () =>
  Transform(({ value }) => (typeof value === "string" ? normalizePhone(value) : value));
