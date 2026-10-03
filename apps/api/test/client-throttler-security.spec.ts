import { forwardedVisitor, trustedProxyNetworks } from "../src/common/client-throttler.guard";

describe("forwarded visitor trust", () => {
  it("keeps an untrusted direct peer's bucket despite forged prefixes", () => {
    const networks = trustedProxyNetworks("");
    expect(forwardedVisitor("198.51.100.1, 203.0.113.50", "gateway", networks)).toBe("203.0.113.50");
    expect(forwardedVisitor("198.51.100.99, 203.0.113.50", "gateway", networks)).toBe("203.0.113.50");
  });
  it("walks only verified proxy peers and ignores an extra client prefix", () => {
    const networks = trustedProxyNetworks("192.0.2.0/24,2001:db8:1::/48");
    expect(forwardedVisitor("198.51.100.99, 203.0.113.50, 192.0.2.10", "gateway", networks)).toBe("203.0.113.50");
    expect(forwardedVisitor("198.51.100.99, 203.0.113.50, 192.0.2.10, 2001:db8:1::2", "gateway", networks)).toBe("203.0.113.50");
  });
  it("fails closed on invalid or globally trusted network configuration", () => {
    for (const value of ["all", "0.0.0.0/0", "::/0", "192.0.2.0/33", "::1/129", "192.0.2.1/"]) {
      expect(() => trustedProxyNetworks(value)).toThrow();
    }
  });
});
