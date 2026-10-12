import { capRange, MAX_RANGE_BYTES, parseRange } from "../src/modules/ingestion/media.controller";

describe("media byte ranges", () => {
  const total = 155_160_662;

  it("answers a player's open-ended first request with one piece, not the whole video", () => {
    expect(capRange(parseRange("bytes=0-", total))).toEqual({ start: 0, end: MAX_RANGE_BYTES - 1 });
  });

  it("caps a seek far into the file the same way", () => {
    expect(capRange(parseRange("bytes=100000000-", total))).toEqual({ start: 100_000_000, end: 100_000_000 + MAX_RANGE_BYTES - 1 });
  });

  it("leaves small and closing ranges alone", () => {
    expect(capRange(parseRange("bytes=0-1", total))).toEqual({ start: 0, end: 1 });
    expect(capRange(parseRange("bytes=-100", total))).toEqual({ start: total - 100, end: total - 1 });
  });

  it("passes no-range and unsatisfiable through", () => {
    expect(capRange(parseRange(undefined, total))).toBeNull();
    expect(capRange(parseRange(`bytes=${total}-`, total))).toBe("unsatisfiable");
  });
});
