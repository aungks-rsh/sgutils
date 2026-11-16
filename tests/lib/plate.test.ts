import { describe, it, expect } from "vitest";
import {
  formatPlate,
  generateManyPlates,
  generatePlate,
  plateCategory,
  plateCheckLetter,
  validatePlate,
  GENERATABLE_PLATE_TYPES,
  type PlateFormat,
} from "../../src/lib/plate";

// Real plates: public buses and plates quoted on Wikipedia.
const REAL_PLATES = [
  "SBS9889U", "SBS3229P", "SBS3964A", "SBS3968P", "SBS3971D", "SBS3973Z", "SBS3975T",
  "SG2017C", "SG5999Z", "TIB1245L", "TIB1246J", "TIB1247G",
  "SDN7484U", "AV1952T", "QEZ6257R", "QBX2223K", "QCK6861Z", "QB1K", "S32H", "E23H",
];

describe("plateCheckLetter", () => {
  it.each(REAL_PLATES)("matches the real plate %s", (plate) => {
    const m = /^([A-Z]+)(\d+)([A-Z])$/.exec(plate)!;
    expect(plateCheckLetter(m[1], m[2])).toBe(m[3]);
  });
  it("uses only the last two letters of a three-letter prefix", () => {
    expect(plateCheckLetter("SBS", 9889)).toBe(plateCheckLetter("BS", 9889));
    expect(plateCheckLetter("XBS", 9889)).toBe(plateCheckLetter("SBS", 9889));
  });
  it("accepts lower case and string numbers", () => {
    expect(plateCheckLetter("sbs", "9889")).toBe("U");
  });
  it("never produces F, I, N, O, Q, V or W", () => {
    for (let n = 1; n <= 9999; n += 7) {
      expect("FINOQVW").not.toContain(plateCheckLetter("SJK", n));
    }
  });
  it("returns null for inputs it cannot compute", () => {
    expect(plateCheckLetter("", 1)).toBeNull();
    expect(plateCheckLetter("ABCD", 1)).toBeNull();
    expect(plateCheckLetter("S1", 1)).toBeNull();
    expect(plateCheckLetter("SBA", 0)).toBeNull();
    expect(plateCheckLetter("SBA", 10000)).toBeNull();
    expect(plateCheckLetter("SBA", "x")).toBeNull();
  });
});

describe("validatePlate — valid plates", () => {
  it.each(REAL_PLATES)("accepts %s", (plate) => {
    expect(validatePlate(plate).valid, plate).toBe(true);
  });
  it("accepts spaces, hyphens and lower case", () => {
    for (const v of ["SBS 9889 U", "sbs9889u", "SBS-9889-U", "  sbs 9889u "]) {
      const r = validatePlate(v);
      expect(r.valid, v).toBe(true);
      expect(r.prefix).toBe("SBS");
      expect(r.number).toBe(9889);
      expect(r.formatted).toBe("SBS 9889 U");
    }
  });
  it("reports the vehicle class and notes the check is checksum only", () => {
    const r = validatePlate("SDN7484U");
    expect(r.category).toBe("Private car");
    expect(r.checks.some((c) => c.status === "info" && /registered/.test(c.label))).toBe(true);
  });
});

describe("validatePlate — rejections", () => {
  it("rejects empty input and symbols", () => {
    expect(validatePlate("").valid).toBe(false);
    expect(validatePlate("   ").valid).toBe(false);
    expect(validatePlate("SBS#9889U").valid).toBe(false);
  });
  it("rejects a wrong checksum letter and names the right one", () => {
    const r = validatePlate("SBS9889A");
    expect(r.valid).toBe(false);
    expect(r.expectedCheckLetter).toBe("U");
    expect(r.reason).toBe('Checksum letter should be "U", not "A".');
  });
  it("detects a single changed digit", () => {
    expect(validatePlate("SBS9888U").valid).toBe(false);
    expect(validatePlate("SBS9989U").valid).toBe(false);
  });
  it("gives the missing checksum letter", () => {
    const r = validatePlate("SBS 9889");
    expect(r.valid).toBe(false);
    expect(r.expectedCheckLetter).toBe("U");
    expect(r.reason).toMatch(/"U"/);
    expect(r.formatted).toBe("SBS 9889 U");
  });
  it("rejects leading zeros, zero and numbers over 9999", () => {
    expect(validatePlate("SBA0123A").valid).toBe(false);
    expect(validatePlate("SBA0A").valid).toBe(false);
    expect(validatePlate("SBA12345A").valid).toBe(false);
  });
  it("rejects wrong shapes", () => {
    for (const v of ["1234", "SBAA1234A", "SBA", "SBA1234AB", "1234SBA", "S1B2"]) {
      expect(validatePlate(v).valid, v).toBe(false);
    }
  });
});

describe("plateCategory", () => {
  it.each([
    ["SBA", "Private car"],
    ["EZ", "Private car"],
    ["S", "Private car"],
    ["SHA", "Taxi"],
    ["SH", "Taxi"],
    ["SBS", "Public bus"],
    ["SG", "Public bus"],
    ["FBA", "Motorcycle"],
    ["AV", "Motorcycle"],
    ["GBA", "Light goods vehicle"],
    ["YN", "Heavy goods vehicle"],
    ["XD", "Very heavy goods vehicle"],
    ["PC", "Private bus"],
    ["PU", "Pulau Ubin vehicle"],
    ["QX", "Emergency or law enforcement vehicle"],
  ])("%s → %s", (prefix, category) => {
    expect(plateCategory(prefix)).toBe(category);
  });
  it("returns undefined for an unknown prefix", () => {
    expect(plateCategory("ZZZ")).toBeUndefined();
  });
});

describe("generate → validate round trip", () => {
  const FORMATS: PlateFormat[] = ["plain", "spaced"];
  it.each(GENERATABLE_PLATE_TYPES)("produces valid %s plates in every format", (type) => {
    for (const format of FORMATS) {
      for (let i = 0; i < 100; i++) {
        const plate = generatePlate({ type, format });
        expect(validatePlate(plate).valid, plate).toBe(true);
      }
    }
  });
});

describe("generatePlate — prefixes", () => {
  const prefixOf = (plate: string) => /^[A-Z]+/.exec(plate)![0];
  it("car plates use issued S series, never I, O, vowels in the middle, taxis or reserved prefixes", () => {
    for (let i = 0; i < 1000; i++) {
      const p = prefixOf(generatePlate({ type: "car" }));
      expect(p).toMatch(/^S[BCDFGJKLMN][A-HJ-NP-Z]$/);
      expect(["SBS", "SMB", "SKY", "SLY", "SCB", "SCC", "SCD", "SCS", "SCT", "SDC"]).not.toContain(p);
    }
  });
  it("other types use their own series and class", () => {
    const expected = {
      motorcycle: [/^FB[A-HJ-NP-Z]$/, "Motorcycle"],
      goods: [/^GB[A-HJ-M]$/, "Light goods vehicle"],
      heavy: [/^Y[A-HJ-NP-R]$/, "Heavy goods vehicle"],
      bus: [/^P[AC]$/, "Private bus"],
      taxi: [/^SH[A-D]$/, "Taxi"],
    } as const;
    for (const [type, [pattern, category]] of Object.entries(expected)) {
      for (let i = 0; i < 200; i++) {
        const p = prefixOf(generatePlate({ type: type as keyof typeof expected }));
        expect(p).toMatch(pattern);
        expect(plateCategory(p)).toBe(category);
      }
    }
  });
  it("numbers have no leading zeros", () => {
    for (let i = 0; i < 300; i++) {
      expect(generatePlate({ type: "car" })).toMatch(/^[A-Z]{3}[1-9]\d{0,3}[A-Z]$/);
    }
  });
});

describe("formatPlate and generateManyPlates", () => {
  it("formats plain and spaced", () => {
    expect(formatPlate("SBA", 1234, "G")).toBe("SBA1234G");
    expect(formatPlate("SBA", 1234, "G", "spaced")).toBe("SBA 1234 G");
  });
  it("produces the requested count and rejects bad counts", () => {
    expect(generateManyPlates({ type: "car" }, 20)).toHaveLength(20);
    expect(() => generateManyPlates({ type: "car" }, 0)).toThrow();
    expect(() => generateManyPlates({ type: "car" }, 101)).toThrow();
    expect(() => generateManyPlates({ type: "car" }, 1.5)).toThrow();
  });
});
