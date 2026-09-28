import { createReadStream, createWriteStream, promises as fs } from "fs";
import { pipeline } from "stream/promises";

/**
 * Moves an MP4's index (the `moov` box) ahead of its media data, the way
 * `qt-faststart` and `ffmpeg -movflags +faststart` do, without re-encoding.
 *
 * Phones and many editors write the index last. A browser then has to fetch
 * the end of the file before it can play the first second, and on a slow
 * line the video sits black, or stutters as it seeks back and forth. With
 * the index first, playback starts after the first few hundred kilobytes.
 *
 * Moving the index shifts every byte of media data by the index's size, so
 * each chunk offset in it (`stco`, `co64`) is moved by the same amount.
 */

interface Box {
  type: string;
  start: number;
  size: number;
}

/** Boxes whose children can hold a chunk-offset table. */
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "mvex", "moof", "traf"]);

async function topLevelBoxes(path: string): Promise<Box[]> {
  const handle = await fs.open(path, "r");
  try {
    const { size: fileSize } = await handle.stat();
    const header = Buffer.alloc(16);
    const boxes: Box[] = [];
    let offset = 0;
    while (offset + 8 <= fileSize) {
      await handle.read(header, 0, 16, offset);
      let size = header.readUInt32BE(0);
      const type = header.toString("latin1", 4, 8);
      if (size === 1) size = Number(header.readBigUInt64BE(8));
      else if (size === 0) size = fileSize - offset;
      if (size < 8 || offset + size > fileSize) throw new Error(`malformed MP4 box "${type}" at ${offset}`);
      boxes.push({ type, start: offset, size });
      offset += size;
    }
    return boxes;
  } finally {
    await handle.close();
  }
}

/** Adds `shift` to every chunk offset inside a moov box, in place. */
function shiftChunkOffsets(buffer: Buffer, from: number, to: number, shift: number) {
  let offset = from;
  while (offset + 8 <= to) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      size = Number(buffer.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = to - offset;
    }
    if (size < headerSize || offset + size > to) throw new Error(`malformed MP4 box "${type}" in moov`);
    const body = offset + headerSize;
    if (CONTAINERS.has(type)) {
      shiftChunkOffsets(buffer, body, offset + size, shift);
    } else if (type === "stco") {
      const count = buffer.readUInt32BE(body + 4);
      for (let i = 0; i < count; i++) {
        const at = body + 8 + i * 4;
        const moved = buffer.readUInt32BE(at) + shift;
        if (moved > 0xffffffff) throw new Error("chunk offset no longer fits in stco");
        buffer.writeUInt32BE(moved, at);
      }
    } else if (type === "co64") {
      const count = buffer.readUInt32BE(body + 4);
      for (let i = 0; i < count; i++) {
        const at = body + 8 + i * 8;
        buffer.writeBigUInt64BE(buffer.readBigUInt64BE(at) + BigInt(shift), at);
      }
    }
    offset += size;
  }
}

/**
 * Writes a faststart copy of `input` to `output` and returns true, or
 * returns false (writing nothing) when the index already comes first.
 * Throws on a file that is not a well-formed MP4.
 */
export async function faststartMp4(input: string, output: string): Promise<boolean> {
  const boxes = await topLevelBoxes(input);
  const moov = boxes.find((box) => box.type === "moov");
  const firstMdat = boxes.findIndex((box) => box.type === "mdat");
  if (!moov) throw new Error("MP4 has no moov box");
  if (firstMdat === -1) throw new Error("MP4 has no mdat box");
  const moovIndex = boxes.indexOf(moov);
  if (moovIndex < firstMdat) return false;
  // Media data after the index would not move, and the uniform shift below
  // would then point at the wrong bytes; such files are left as they are.
  if (boxes.slice(moovIndex + 1).some((box) => box.type === "mdat")) return false;

  const handle = await fs.open(input, "r");
  const index = Buffer.alloc(moov.size);
  try {
    await handle.read(index, 0, moov.size, moov.start);
  } finally {
    await handle.close();
  }
  // Everything from the first mdat onwards moves down by the index's size.
  shiftChunkOffsets(index, 8, moov.size, moov.size);

  const out = createWriteStream(output);
  const copy = async (box: Box) => {
    await pipeline(createReadStream(input, { start: box.start, end: box.start + box.size - 1 }), out, { end: false });
  };
  try {
    for (const box of boxes.slice(0, firstMdat)) await copy(box);
    await new Promise<void>((resolve, reject) => out.write(index, (err) => (err ? reject(err) : resolve())));
    for (const box of boxes.slice(firstMdat)) if (box !== moov) await copy(box);
  } finally {
    await new Promise<void>((resolve) => out.end(resolve));
  }
  return true;
}
