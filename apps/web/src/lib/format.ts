const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

/** Format a visible number with Persian digits without changing the API value. */
export function toPersianDigits(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => persianDigits[Number(digit)]);
}

export function toEnglishDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit))).replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit))).replace(/٫/g, ".");
}

export function formatPersianNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat("fa-IR", options).format(value);
}
