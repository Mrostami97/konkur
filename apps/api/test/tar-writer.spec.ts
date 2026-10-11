import { PassThrough, Readable } from "stream";
import { TarWriter } from "../src/modules/backup/tar-writer";

async function archive(build: (tar: TarWriter) => Promise<void>) {
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise((resolve) => out.on("end", resolve));
  await build(new TarWriter(out));
  await done;
  return Buffer.concat(chunks);
}

describe("tar writer", () => {
  it("writes valid ustar headers, padded data and the end marker", async () => {
    const bytes = await archive(async (tar) => {
      await tar.addBuffer("a.txt", Buffer.from("hello"));
      await tar.finish();
    });
    expect(bytes.length).toBe(512 + 512 + 1024);
    expect(bytes.subarray(0, 5).toString()).toBe("a.txt");
    expect(bytes.subarray(257, 262).toString()).toBe("ustar");
    expect(parseInt(bytes.subarray(124, 135).toString(), 8)).toBe(5);
    const stored = parseInt(bytes.subarray(148, 154).toString(), 8);
    const header = Buffer.from(bytes.subarray(0, 512));
    header.fill(" ", 148, 156);
    expect(header.reduce((sum, byte) => sum + byte, 0)).toBe(stored);
    expect(bytes.subarray(512, 517).toString()).toBe("hello");
  });

  it("carries a Persian name in a pax header", async () => {
    const bytes = await archive(async (tar) => {
      await tar.addBuffer("media/جزوه.pdf", Buffer.from("x"));
      await tar.finish();
    });
    expect(bytes[156]).toBe("x".charCodeAt(0));
    const record = bytes.subarray(512, 512 + parseInt(bytes.subarray(124, 135).toString(), 8)).toString("utf8");
    expect(record).toBe(`${Buffer.byteLength(record)} path=media/جزوه.pdf\n`);
  });

  it("refuses a stream whose length differs from the stated size", async () => {
    const out = new PassThrough();
    out.resume();
    await expect(new TarWriter(out).addStream("b", 10, Readable.from([Buffer.from("short")]))).rejects.toThrow("expected 10");
  });
});
