import { describe, it, expect } from "vitest";
import {
  generateUen,
  generateManyUen,
  validateUen,
  ENTITY_TYPE_CODES,
  type UenFormat,
} from "../../src/lib/uen";

const FORMATS: UenFormat[] = ["business", "local", "other"];

const PATTERNS: Record<UenFormat, RegExp> = {
  business: /^\d{8}[A-Z]$/,
  local: /^\d{9}[A-Z]$/,
  other: /^[STR]\d{2}[A-Z]{2}\d{4}[A-Z]$/,
};

describe("generate → validate round trip", () => {
  it.each(FORMATS)("produces 100 structurally-valid %s UENs", (format) => {
    for (let i = 0; i < 100; i++) {
      const uen = generateUen({ format });
      expect(uen).toMatch(PATTERNS[format]);
      const result = validateUen(uen);
      expect(result.valid).toBe(true);
      expect(result.format).toBe(format);
    }
  });
});

describe("generateUen — options", () => {
  it("honours a fixed year for local companies", () => {
    const uen = generateUen({ format: "local", year: 2019 });
    expect(uen.slice(0, 4)).toBe("2019");
    expect(uen).toMatch(PATTERNS.local);
  });
  it("honours prefix + entity code for other entities", () => {
    const uen = generateUen({ format: "other", prefix: "T", entityCode: "LL" });
    expect(uen[0]).toBe("T");
    expect(uen.slice(3, 5)).toBe("LL");
    expect(uen).toMatch(PATTERNS.other);
  });
  it("maps a fixed year to the yy slot for other entities", () => {
    const uen = generateUen({ format: "other", year: 2009, prefix: "T" });
    expect(uen.slice(1, 3)).toBe("09");
  });
});

describe("generateManyUen", () => {
  it("produces the requested count", () => {
    expect(generateManyUen({ format: "business" }, 5)).toHaveLength(5);
    expect(generateManyUen({ format: "other" }, 20)).toHaveLength(20);
  });
  it("rejects out-of-range or non-integer counts", () => {
    expect(() => generateManyUen({ format: "local" }, 0)).toThrow();
    expect(() => generateManyUen({ format: "local" }, 101)).toThrow();
    expect(() => generateManyUen({ format: "local" }, 2.5)).toThrow();
  });
});

describe("validateUen — format detection", () => {
  it("detects a business UEN", () => {
    const r = validateUen("53333444A");
    expect(r.valid).toBe(true);
    expect(r.format).toBe("business");
  });
  it("detects a local-company UEN and surfaces the year", () => {
    const r = validateUen("201912345K");
    expect(r.valid).toBe(true);
    expect(r.format).toBe("local");
    expect(r.checks.some((c) => c.label.includes("2019"))).toBe(true);
  });
  it("detects an other-entity UEN and resolves a known entity code", () => {
    const r = validateUen("T09LL0001B");
    expect(r.valid).toBe(true);
    expect(r.format).toBe("other");
    expect(r.entityTypeCode).toBe("LL");
    expect(r.entityTypeName).toBe(ENTITY_TYPE_CODES.LL);
  });
  it("accepts an unknown entity code without rejecting", () => {
    const r = validateUen("T09ZZ0001B");
    expect(r.valid).toBe(true);
    expect(r.entityTypeCode).toBe("ZZ");
    expect(r.entityTypeName).toBeUndefined();
  });
});

describe("validateUen — never claims to verify the check letter", () => {
  it("always includes a check-letter info note for valid UENs", () => {
    for (const v of ["53333444A", "201912345K", "T09LL0001B"]) {
      const r = validateUen(v);
      expect(
        r.checks.some((c) => c.status === "info" && /check letter/i.test(c.label)),
      ).toBe(true);
    }
  });
  it("never reports a fail status (structure-only, no checksum)", () => {
    const r = validateUen("53333444A");
    expect(r.checks.every((c) => c.status !== "fail")).toBe(true);
  });
});

describe("validateUen — rejections", () => {
  it("rejects empty input", () => {
    expect(validateUen("").valid).toBe(false);
    expect(validateUen("   ").valid).toBe(false);
  });
  it("rejects wrong length", () => {
    expect(validateUen("5333444A").valid).toBe(false);
    expect(validateUen("533334445XA").valid).toBe(false);
  });
  it("rejects non-alphanumeric input", () => {
    expect(validateUen("5333-444A").valid).toBe(false);
  });
  it("rejects a 10-char string matching no format", () => {
    // leading letter that is not S/T/R, with trailing digit
    expect(validateUen("A0912340001").valid).toBe(false);
  });
  it("rejects garbage", () => {
    expect(validateUen("hello").valid).toBe(false);
  });
});

describe("validateUen — normalization", () => {
  it("accepts lowercase and surrounding whitespace", () => {
    const r = validateUen("  t09ll0001b  ");
    expect(r.valid).toBe(true);
    expect(r.format).toBe("other");
    expect(r.entityTypeCode).toBe("LL");
  });
});
