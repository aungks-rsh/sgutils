import { describe, it, expect } from "vitest";
import {
  parseDatetime,
  formatUtc,
  formatSgt,
  formatIso,
  formatRelative,
} from "../../src/lib/datetime";

describe("parseDatetime — Unix timestamps", () => {
  it("parses 10-digit as seconds", () => {
    const r = parseDatetime("1700000000");
    expect(r.valid).toBe(true);
    expect(r.ms).toBe(1_700_000_000_000);
  });
  it("parses 13-digit as milliseconds", () => {
    const r = parseDatetime("1700000000000");
    expect(r.valid).toBe(true);
    expect(r.ms).toBe(1_700_000_000_000);
  });
  it("parses small integer as seconds", () => {
    const r = parseDatetime("0");
    expect(r.valid).toBe(true);
    expect(r.ms).toBe(0);
  });
  it("rejects 11-digit ambiguous", () => {
    const r = parseDatetime("17000000000");
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/ambiguous/i);
  });
});

describe("parseDatetime — ISO and custom format", () => {
  it("parses ISO 8601 with Z", () => {
    const r = parseDatetime("2026-04-24T06:30:00Z");
    expect(r.valid).toBe(true);
    expect(r.ms).toBe(Date.parse("2026-04-24T06:30:00Z"));
  });
  it("parses ISO 8601 with offset", () => {
    const r = parseDatetime("2026-04-24T14:30:00+08:00");
    expect(r.valid).toBe(true);
    expect(r.ms).toBe(Date.parse("2026-04-24T14:30:00+08:00"));
  });
  it("parses yyyy-MM-dd HH:mm:ss.fff — assumes SGT", () => {
    const r = parseDatetime("2026-04-24 14:30:00.123");
    expect(r.valid).toBe(true);
    expect(r.ms).toBe(Date.parse("2026-04-24T14:30:00.123+08:00"));
  });
  it("parses yyyy-MM-dd HH:mm:ss without ms — assumes SGT", () => {
    const r = parseDatetime("2026-04-24 14:30:00");
    expect(r.valid).toBe(true);
    expect(r.ms).toBe(Date.parse("2026-04-24T14:30:00+08:00"));
  });
  it("parses yyyy-MM-dd alone — midnight SGT", () => {
    const r = parseDatetime("2026-04-24");
    expect(r.valid).toBe(true);
    expect(r.ms).toBe(Date.parse("2026-04-24T00:00:00+08:00"));
  });
});

describe("parseDatetime — DD/MM/YYYY (Singapore format)", () => {
  it("parses DD/MM/YYYY as SGT midnight", () => {
    const r = parseDatetime("24/04/2026");
    expect(r.valid).toBe(true);
    expect(r.ms).toBe(Date.parse("2026-04-24T00:00:00+08:00"));
  });
  it("parses DD/MM/YYYY with time as SGT", () => {
    const r = parseDatetime("24/04/2026 14:30:00");
    expect(r.valid).toBe(true);
    expect(r.ms).toBe(Date.parse("2026-04-24T14:30:00+08:00"));
  });
  it("rejects impossible date (day 32)", () => {
    expect(parseDatetime("32/04/2026").valid).toBe(false);
  });
  it("rejects impossible month (13)", () => {
    expect(parseDatetime("01/13/2026").valid).toBe(false);
  });
});

describe("parseDatetime — rejections", () => {
  it("rejects empty", () => {
    expect(parseDatetime("").valid).toBe(false);
    expect(parseDatetime("   ").valid).toBe(false);
  });
  it("rejects garbage", () => {
    expect(parseDatetime("not a date").valid).toBe(false);
  });
});

describe("formatters", () => {
  const ms = Date.parse("2026-04-24T14:30:00.123Z");

  it("formatUtc", () => {
    expect(formatUtc(ms)).toBe("2026-04-24 14:30:00.123");
  });
  it("formatSgt (UTC+8)", () => {
    expect(formatSgt(ms)).toBe("2026-04-24 22:30:00.123");
  });
  it("formatIso", () => {
    expect(formatIso(ms)).toBe("2026-04-24T14:30:00.123Z");
  });
});

describe("formatRelative", () => {
  const now = Date.parse("2026-04-24T12:00:00Z");
  it("reports past minutes", () => {
    expect(formatRelative(now - 5 * 60 * 1000, now)).toMatch(/5 minutes ago/);
  });
  it("reports future hours", () => {
    expect(formatRelative(now + 2 * 60 * 60 * 1000, now)).toMatch(/in 2 hours/);
  });
  it("reports just now for sub-second diffs", () => {
    expect(formatRelative(now, now)).toBe("just now");
  });
});
