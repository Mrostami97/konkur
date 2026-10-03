import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConsoleOtpProvider } from "../src/modules/identity/otp-provider";

describe("ConsoleOtpProvider production boundary", () => {
  it("never logs a phone or code in production and refuses delivery", async () => {
    const previous = process.env.NODE_ENV;
    const logger = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    process.env.NODE_ENV = "production";
    try {
      await expect(new ConsoleOtpProvider().send("synthetic-phone", "synthetic-code")).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(logger).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
      logger.mockRestore();
    }
  });
});
