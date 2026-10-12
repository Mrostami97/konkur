import { createHmac, timingSafeEqual } from "crypto";

export interface TelegramUser {
  id: string;
  firstName: string | null;
  username: string | null;
}

/** How long a mini app launch stays good for signing in. */
const MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * Checks the init data Telegram hands the mini app and returns its user, or
 * null. Telegram signs it with a key derived from the bot token
 * (HMAC-SHA256 of the token keyed by "WebAppData"), over the other fields
 * sorted and joined by newlines, so only Telegram can produce it.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(initData: string, botToken: string, now = Date.now()): TelegramUser | null {
  if (!initData || !botToken || initData.length > 4096) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete("hash");
  const checkString = [...params.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > MAX_AGE_SECONDS) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "null") as { id?: number; first_name?: string; username?: string } | null;
    if (!user || typeof user.id !== "number") return null;
    return { id: String(user.id), firstName: user.first_name ?? null, username: user.username ?? null };
  } catch {
    return null;
  }
}
