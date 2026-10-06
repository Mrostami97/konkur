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

/** Money is stored and sent as an integer count of rial; only the display
 * carries the unit. */
export function formatRial(amountRial: number): string {
  return `${amountRial.toLocaleString("fa-IR")} ریال`;
}

/** The same amount the way people say it: «۱۵ میلیون تومان», «۳۰۰ هزار تومان». */
export function formatToman(amountRial: number): string {
  const toman = Math.round(amountRial / 10);
  if (toman >= 1_000_000 && toman % 100_000 === 0) return `${formatPersianNumber(toman / 1_000_000)} میلیون تومان`;
  if (toman >= 1_000 && toman % 1_000 === 0) return `${formatPersianNumber(toman / 1_000)} هزار تومان`;
  return `${formatPersianNumber(toman)} تومان`;
}

/** A length in minutes as people say it: «۴۲ ساعت و ۳۰ دقیقه», «۴۰ ساعت», «۴۵ دقیقه». */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${toPersianDigits(rest)} دقیقه`;
  if (rest === 0) return `${toPersianDigits(hours)} ساعت`;
  return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(rest)} دقیقه`;
}

/** The same length for schema.org, ISO 8601: PT42H30M. */
export function isoDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `PT${hours ? `${hours}H` : ""}${rest || !hours ? `${rest}M` : ""}`;
}

/** Revenue shares are stored in basis points so the arithmetic stays in
 * integers; people read percent. */
export function formatSharePercent(basisPoints: number): string {
  return `${formatPersianNumber(basisPoints / 100, { maximumFractionDigits: 2 })}٪`;
}

/**
 * The konkur percentage: a wrong answer costs a third of a right one. Same
 * formula as konkurPercent() in the API's assessment service, which ranks on
 * it -- the stored percentCorrect ignores wrong answers and would flatter a
 * candidate who guessed.
 */
export function konkurPercent(score: { correctCount: number; wrongCount: number; unansweredCount: number }): number {
  const total = score.correctCount + score.wrongCount + score.unansweredCount;
  return total > 0 ? ((3 * score.correctCount - score.wrongCount) / (3 * total)) * 100 : 0;
}
