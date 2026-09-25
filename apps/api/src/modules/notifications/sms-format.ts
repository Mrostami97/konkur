/** Dates and times as they go into an SMS: Solar Hijri, Tehran time, and no
 * spaces (Kavenegar variables may not contain them). */
const DATE = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const TIME = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hour12: false });

export function smsDate(date: Date): string {
  return DATE.format(date).replace(/\s+/g, "");
}

export function smsTime(date: Date): string {
  return TIME.format(date).replace(/\s+/g, "");
}
