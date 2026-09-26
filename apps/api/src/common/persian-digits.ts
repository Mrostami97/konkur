const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

/** Numbers inside messages the admin panel shows as they are. */
export function fa(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN[Number(digit)]);
}
