import { describe, expect, it } from "vitest";

import { pickDueKeys } from "@/lib/offers/scheduled-sync";

const NOW = new Date("2026-09-11T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const keys = [{ key: "fresh" }, { key: "old" }, { key: "never" }, { key: "older" }];
const lastRunAt = new Map([
  ["fresh", hoursAgo(1)],
  ["old", hoursAgo(7)],
  ["older", hoursAgo(30)],
]);

describe("pickDueKeys", () => {
  it("skips searches younger than 6 hours and starts with the never run, then the oldest", () => {
    expect(pickDueKeys(keys, lastRunAt, NOW, 10).map((k) => k.key)).toEqual([
      "never",
      "older",
      "old",
    ]);
  });

  it("caps the batch", () => {
    expect(pickDueKeys(keys, lastRunAt, NOW, 2).map((k) => k.key)).toEqual(["never", "older"]);
  });

  it("treats exactly 6 hours as due", () => {
    expect(pickDueKeys([{ key: "six" }], new Map([["six", hoursAgo(6)]]), NOW, 1)).toHaveLength(1);
  });
});
