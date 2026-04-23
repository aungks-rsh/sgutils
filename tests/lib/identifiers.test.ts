import { describe, it, expect } from "vitest";
import {
  generateId,
  generateMany,
  validate,
  type IdPrefix,
} from "../../src/lib/identifiers";

const ALL_PREFIXES: IdPrefix[] = ["S", "T", "F", "G", "M"];

describe("generate → validate round trip", () => {
  it.each(ALL_PREFIXES)("produces 100 valid %s-prefix IDs", (prefix) => {
    for (let i = 0; i < 100; i++) {
      const id = generateId(prefix);
      expect(id).toMatch(/^[STFGM]\d{7}[A-Z]$/);
      expect(id[0]).toBe(prefix);
      const result = validate(id);
      expect(result.valid).toBe(true);
      expect(result.prefix).toBe(prefix);
    }
  });
});

describe("generateMany", () => {
  it("produces the requested count", () => {
    expect(generateMany("S", 5)).toHaveLength(5);
    expect(generateMany("M", 20)).toHaveLength(20);
  });
  it("rejects out-of-range or non-integer counts", () => {
    expect(() => generateMany("S", 0)).toThrow();
    expect(() => generateMany("S", 101)).toThrow();
    expect(() => generateMany("S", 1.5)).toThrow();
  });
});

describe("validate — known-good fixtures", () => {
  it("S0000001I (NRIC, S prefix)", () => {
    const r = validate("S0000001I");
    expect(r.valid).toBe(true);
    expect(r.kind).toBe("NRIC");
    expect(r.prefix).toBe("S");
  });
  it("T0000001E (NRIC, T prefix)", () => {
    expect(validate("T0000001E").valid).toBe(true);
  });
  it("F0000001U (FIN, F prefix)", () => {
    const r = validate("F0000001U");
    expect(r.valid).toBe(true);
    expect(r.kind).toBe("FIN");
  });
  it("G0000001P (FIN, G prefix)", () => {
    expect(validate("G0000001P").valid).toBe(true);
  });
  it("M0000001Q (FIN, M prefix)", () => {
    expect(validate("M0000001Q").valid).toBe(true);
  });
});

describe("validate — rejections", () => {
  it("rejects wrong checksum", () => {
    const r = validate("S0000001A");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/checksum/i);
  });
  it("rejects invalid prefix letter", () => {
    expect(validate("Z0000001A").valid).toBe(false);
  });
  it("rejects wrong length", () => {
    expect(validate("S000001A").valid).toBe(false);
    expect(validate("S00000012A").valid).toBe(false);
  });
  it("rejects missing checksum letter", () => {
    expect(validate("S00000011").valid).toBe(false);
  });
  it("rejects garbage", () => {
    expect(validate("hello").valid).toBe(false);
    expect(validate("").valid).toBe(false);
  });
});

describe("validate — normalization", () => {
  it("accepts lowercase input", () => {
    expect(validate("s0000001i").valid).toBe(true);
  });
  it("trims whitespace", () => {
    expect(validate("  S0000001I  ").valid).toBe(true);
  });
});
