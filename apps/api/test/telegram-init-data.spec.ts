import { verifyTelegramInitData } from "../src/modules/identity/telegram-init-data";
import { signedInitData } from "./helpers/telegram";

describe("Telegram mini app init data", () => {
  const token = "123456:test-token";

  it("accepts data Telegram signed and reads its user", () => {
    const data = signedInitData(token, { id: 42, first_name: "سارا", username: "sara" });
    expect(verifyTelegramInitData(data, token)).toEqual({ id: "42", firstName: "سارا", username: "sara" });
  });

  it("refuses data signed with another bot's token, or edited", () => {
    expect(verifyTelegramInitData(signedInitData("999:other", { id: 42 }), token)).toBeNull();
    const data = signedInitData(token, { id: 42 }).replace("%2242%22", "%2243%22").replace("42", "43");
    expect(verifyTelegramInitData(data, token)).toBeNull();
  });

  it("refuses an old launch and missing pieces", () => {
    expect(verifyTelegramInitData(signedInitData(token, { id: 42 }, Math.floor(Date.now() / 1000) - 2 * 86400), token)).toBeNull();
    expect(verifyTelegramInitData("", token)).toBeNull();
    expect(verifyTelegramInitData(signedInitData(token, { id: 42 }), "")).toBeNull();
  });
});
