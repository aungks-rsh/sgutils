import { describe, it, expect } from "vitest";
import {
  generateUen,
  generateManyUen,
  validateUen,
  uenCheckLetter,
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
  it.each(FORMATS)("produces 100 valid %s UENs with a correct check letter", (format) => {
    for (let i = 0; i < 100; i++) {
      const uen = generateUen({ format });
      expect(uen).toMatch(PATTERNS[format]);
      const result = validateUen(uen);
      expect(result.valid).toBe(true);
      expect(result.format).toBe(format);
      expect(result.checkLetterVerified).toBe(true);
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
  it("never generates a future year for the T prefix", () => {
    const maxYy = new Date().getFullYear() % 100;
    for (let i = 0; i < 200; i++) {
      const uen = generateUen({ format: "other", prefix: "T" });
      expect(Number(uen.slice(1, 3))).toBeLessThanOrEqual(maxYy);
    }
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
    const r = validateUen("53333444J");
    expect(r.valid).toBe(true);
    expect(r.format).toBe("business");
  });
  it("detects a local-company UEN and surfaces the year", () => {
    const r = validateUen("201912345R");
    expect(r.valid).toBe(true);
    expect(r.format).toBe("local");
    expect(r.checks.some((c) => c.label.includes("2019"))).toBe(true);
  });
  it("detects an other-entity UEN and resolves a known entity code", () => {
    const r = validateUen("T09LL0001D");
    expect(r.valid).toBe(true);
    expect(r.format).toBe("other");
    expect(r.entityTypeCode).toBe("LL");
    expect(r.entityTypeName).toBe(ENTITY_TYPE_CODES.LL);
  });
  it("accepts an unknown entity code without rejecting", () => {
    const uen = "T09QQ0001" + uenCheckLetter("T09QQ0001");
    const r = validateUen(uen);
    expect(r.valid).toBe(true);
    expect(r.entityTypeCode).toBe("QQ");
    expect(r.entityTypeName).toBeUndefined();
  });
  it("reads the century from the prefix", () => {
    const r = validateUen("R90SS0004L");
    expect(r.checks.some((c) => c.label.includes("1890"))).toBe(true);
  });
});

// Real UENs from ACRA's open dataset on data.gov.sg (public registry data),
// plus the python-stdnum reference vectors.
const REAL_UENS: Record<UenFormat, string[]> = {
  business: ["53250767C", "00192200M"],
  local: ["201201936C", "199203392Z", "201305833D", "197401143C"],
  other: ["S16FC0121D", "T01FC6132D", "R90SS0004L", "R46MQ0036J", "R96MQ0040J"],
};

describe("check letter — real UENs", () => {
  it.each(FORMATS)("accepts real %s UENs", (format) => {
    for (const uen of REAL_UENS[format]) {
      const r = validateUen(uen);
      expect(r.valid, uen).toBe(true);
      expect(r.format).toBe(format);
      expect(r.checkLetterVerified).toBe(true);
      expect(uenCheckLetter(uen.slice(0, -1))).toBe(uen.slice(-1));
    }
  });
});

describe("check letter — wrong letters are rejected", () => {
  it("rejects a wrong check letter and names the expected one", () => {
    const r = validateUen("201201936D");
    expect(r.valid).toBe(false);
    expect(r.format).toBe("local");
    expect(r.expectedCheckLetter).toBe("C");
    expect(r.reason).toContain('"C"');
    expect(r.checks.some((c) => c.status === "fail")).toBe(true);
  });
  it("rejects every other letter for a real UEN of each format", () => {
    for (const uen of ["53250767C", "201201936C", "T01FC6132D"]) {
      for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        const candidate = uen.slice(0, -1) + letter;
        expect(validateUen(candidate).valid, candidate).toBe(letter === uen.slice(-1));
      }
    }
  });
  it("detects a single changed digit", () => {
    // 201201936C with each digit position bumped by one
    const uen = "201201936C";
    for (let i = 0; i < 9; i++) {
      const bumped = String((Number(uen[i]) + 1) % 10);
      const candidate = uen.slice(0, i) + bumped + uen.slice(i + 1);
      expect(validateUen(candidate).valid, candidate).toBe(false);
    }
  });
});

describe("check letter — bodies the formula cannot handle", () => {
  it("returns null for an entity code with I, O, Y or Z", () => {
    expect(uenCheckLetter("T09ZZ0001")).toBeNull();
  });
  it("keeps such a UEN valid on structure, flagged as not verified", () => {
    const r = validateUen("T09ZZ0001B");
    expect(r.valid).toBe(true);
    expect(r.checkLetterVerified).toBe(false);
    expect(
      r.checks.some((c) => c.status === "info" && /check letter/i.test(c.label)),
    ).toBe(true);
  });
  it("returns null for a body matching no format", () => {
    expect(uenCheckLetter("hello")).toBeNull();
    expect(uenCheckLetter("1234567")).toBeNull();
  });
});

describe("entity-type codes", () => {
  it("every known code can be generated with a verifiable check letter", () => {
    for (const code of Object.keys(ENTITY_TYPE_CODES)) {
      const uen = generateUen({ format: "other", entityCode: code });
      expect(validateUen(uen).checkLetterVerified, uen).toBe(true);
    }
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
    const r = validateUen("  t09ll0001d  ");
    expect(r.valid).toBe(true);
    expect(r.format).toBe("other");
    expect(r.entityTypeCode).toBe("LL");
  });
});
