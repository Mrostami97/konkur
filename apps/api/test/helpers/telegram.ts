import { createHmac } from "crypto";

/** Init data signed the way Telegram signs it, for tests. */
export function signedInitData(botToken: string, user: { id: number; first_name?: string; username?: string }, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: "AAE-test", user: JSON.stringify(user) });
  const checkString = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", createHmac("sha256", secret).update(checkString).digest("hex"));
  return params.toString();
}
