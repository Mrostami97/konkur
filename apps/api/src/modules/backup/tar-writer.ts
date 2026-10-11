import { once } from "events";
import type { Readable, Writable } from "stream";

const BLOCK = 512;

function octal(value: number, width: number) {
  return value.toString(8).padStart(width - 1, "0") + "\0";
}

function header(name: string, size: number, mtime: Date, type: "0" | "x") {
  const block = Buffer.alloc(BLOCK);
  block.write(name, 0, 100, "utf8");
  block.write(octal(0o644, 8), 100, "ascii");
  block.write(octal(0, 8), 108, "ascii");
  block.write(octal(0, 8), 116, "ascii");
  block.write(octal(size, 12), 124, "ascii");
  block.write(octal(Math.floor(mtime.getTime() / 1000), 12), 136, "ascii");
  block.write("        ", 148, "ascii");
  block.write(type, 156, "ascii");
  block.write("ustar\0", 257, "ascii");
  block.write("00", 263, "ascii");
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(octal(sum, 7) + " ", 148, "ascii");
  return block;
}

/** A pax record "<len> path=<name>\n", whose length counts its own digits. */
function paxRecord(key: string, value: string) {
  const body = ` ${key}=${value}\n`;
  let length = Buffer.byteLength(body);
  while (String(length).length + Buffer.byteLength(body) !== length) length = String(length).length + Buffer.byteLength(body);
  return Buffer.from(`${length}${body}`, "utf8");
}

/**
 * Writes a POSIX tar archive straight to a stream, honouring backpressure,
 * so a backup of any size never sits in memory. Names that are long or not
 * ASCII (Persian file names) travel in a pax header, which tar, 7-Zip and
 * Windows' own extractor all read.
 */
export class TarWriter {
  constructor(private readonly out: Writable) {}

  private async write(chunk: Buffer) {
    if (!this.out.write(chunk)) await once(this.out, "drain");
  }

  private async pad(size: number) {
    const rest = size % BLOCK;
    if (rest) await this.write(Buffer.alloc(BLOCK - rest));
  }

  private async writeHeader(name: string, size: number, mtime: Date) {
    if (Buffer.byteLength(name) > 100 || /[^\x20-\x7e]/.test(name)) {
      const pax = paxRecord("path", name);
      await this.write(header("PaxHeader", pax.length, mtime, "x"));
      await this.write(pax);
      await this.pad(pax.length);
    }
    await this.write(header(name.replace(/[^\x20-\x7e]/g, "_").slice(0, 100), size, mtime, "0"));
  }

  async addBuffer(name: string, data: Buffer, mtime = new Date()) {
    await this.writeHeader(name, data.length, mtime);
    await this.write(data);
    await this.pad(data.length);
  }

  /** `size` must be exact: tar states it before the bytes, so a short or long stream would corrupt the archive. */
  async addStream(name: string, size: number, stream: Readable, mtime = new Date()) {
    await this.writeHeader(name, size, mtime);
    let written = 0;
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      written += buffer.length;
      if (written > size) throw new Error(`${name}: more bytes than its stated size`);
      await this.write(buffer);
    }
    if (written !== size) throw new Error(`${name}: ${written} bytes, expected ${size}`);
    await this.pad(size);
  }

  /** Two empty blocks end a tar archive. */
  async finish() {
    await this.write(Buffer.alloc(BLOCK * 2));
    this.out.end();
  }
}
