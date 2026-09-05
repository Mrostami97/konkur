import { sha256Buffer, sha256Json } from "../src/modules/ingestion/checksum";

describe("sha256Json", () => {
  it("is stable across key order", () => {
    const a = sha256Json({ a: 1, b: { c: 2, d: 3 } });
    const b = sha256Json({ b: { d: 3, c: 2 }, a: 1 });
    expect(a).toBe(b);
  });

  it("differs when a value changes", () => {
    const a = sha256Json({ a: 1 });
    const b = sha256Json({ a: 2 });
    expect(a).not.toBe(b);
  });

  it("hashes arrays order-sensitively", () => {
    const a = sha256Json([1, 2, 3]);
    const b = sha256Json([3, 2, 1]);
    expect(a).not.toBe(b);
  });
});

describe("sha256Buffer", () => {
  it("matches a known sha256 digest", () => {
    // sha256("hello") per common test vectors
    expect(sha256Buffer(Buffer.from("hello"))).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});
