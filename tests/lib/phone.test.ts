import { describe, it, expect } from "vitest";
import {
  formatPhone,
  generateManyPhones,
  generateNational,
  generatePhone,
  validatePhone,
  GENERATABLE_TYPES,
  type PhoneFormat,
} from "../../src/lib/phone";

const FORMATS: PhoneFormat[] = ["plain", "spaced", "intl", "e164"];

describe("generate → validate round trip", () => {
  it.each(GENERATABLE_TYPES)("produces 200 valid %s numbers in every format", (type) => {
    for (const format of FORMATS) {
      for (let i = 0; i < 50; i++) {
        const number = generatePhone({ type, format });
        const r = validatePhone(number);
        expect(r.valid, number).toBe(true);
        expect(r.type, number).toBe(type);
      }
    }
  });
});

describe("generateNational — ranges", () => {
  it("mobile starts with 8 or 9, never 99 and never 800", () => {
    for (let i = 0; i < 500; i++) {
      const n = generateNational("mobile");
      expect(n).toMatch(/^[89]\d{7}$/);
      expect(n.startsWith("99")).toBe(false);
      expect(n.startsWith("80")).toBe(false);
    }
  });
  it("fixed line starts with 6 and VoIP with 3", () => {
    expect(generateNational("landline")).toMatch(/^6\d{7}$/);
    expect(generateNational("voip")).toMatch(/^3\d{7}$/);
  });
  it("toll-free is 1800 + 7 digits outside the managed ranges", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateNational("tollfree")).toMatch(/^1800[2-8]\d{6}$/);
    }
  });
});

describe("generateManyPhones", () => {
  it("produces the requested count", () => {
    expect(generateManyPhones({ type: "mobile" }, 20)).toHaveLength(20);
  });
  it("rejects out-of-range or non-integer counts", () => {
    expect(() => generateManyPhones({ type: "mobile" }, 0)).toThrow();
    expect(() => generateManyPhones({ type: "mobile" }, 101)).toThrow();
    expect(() => generateManyPhones({ type: "mobile" }, 1.5)).toThrow();
  });
});

describe("formatPhone", () => {
  it("formats an 8-digit number four ways", () => {
    expect(formatPhone("91234567", "plain")).toBe("91234567");
    expect(formatPhone("91234567", "spaced")).toBe("9123 4567");
    expect(formatPhone("91234567", "intl")).toBe("+65 9123 4567");
    expect(formatPhone("91234567", "e164")).toBe("+6591234567");
  });
  it("never adds +65 to a 1800 number", () => {
    expect(formatPhone("18007654321", "plain")).toBe("18007654321");
    expect(formatPhone("18007654321", "intl")).toBe("1800 765 4321");
    expect(formatPhone("18007654321", "e164")).toBe("1800 765 4321");
  });
});

describe("validatePhone — types", () => {
  it("detects mobile numbers", () => {
    for (const v of ["91234567", "81234567", "98765432"]) {
      const r = validatePhone(v);
      expect(r.valid, v).toBe(true);
      expect(r.type).toBe("mobile");
    }
  });
  it("detects fixed line and VoIP", () => {
    expect(validatePhone("61234567").type).toBe("landline");
    expect(validatePhone("31234567").type).toBe("voip");
  });
  it("detects 1800, 1900 and 800 service numbers", () => {
    expect(validatePhone("1800 765 4321").type).toBe("tollfree");
    expect(validatePhone("1900 765 4321").type).toBe("premium");
    expect(validatePhone("800 765 4321").type).toBe("intl-tollfree");
  });
  it("detects emergency codes", () => {
    expect(validatePhone("999").type).toBe("emergency");
    expect(validatePhone("995").type).toBe("emergency");
  });
  it("returns national, E.164 and display forms", () => {
    const r = validatePhone("+65 9123-4567");
    expect(r.national).toBe("91234567");
    expect(r.e164).toBe("+6591234567");
    expect(r.formatted).toBe("9123 4567");
  });
  it("gives no E.164 form for service numbers", () => {
    const r = validatePhone("18007654321");
    expect(r.e164).toBeUndefined();
    expect(r.formatted).toBe("1800 765 4321");
  });
  it("always notes that the check is format only", () => {
    const r = validatePhone("91234567");
    expect(r.checks.some((c) => c.status === "info" && /format only/i.test(c.label))).toBe(true);
  });
});

describe("validatePhone — country code and separators", () => {
  it.each(["+6591234567", "+65 9123 4567", "6591234567", "0065 9123 4567", "(65) 9123-4567", "9123.4567"])(
    "accepts %s",
    (v) => {
      const r = validatePhone(v);
      expect(r.valid, v).toBe(true);
      expect(r.national).toBe("91234567");
    },
  );
  it("keeps an 8-digit fixed line that happens to start with 65", () => {
    const r = validatePhone("65123456");
    expect(r.valid).toBe(true);
    expect(r.type).toBe("landline");
    expect(r.national).toBe("65123456");
  });
  it("rejects another country code", () => {
    const r = validatePhone("+60 12 345 6789");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/\+65/);
  });
});

describe("validatePhone — rejections", () => {
  it("rejects empty input", () => {
    expect(validatePhone("").valid).toBe(false);
    expect(validatePhone("   ").valid).toBe(false);
  });
  it("rejects letters and symbols", () => {
    expect(validatePhone("9123 ABCD").valid).toBe(false);
    expect(validatePhone("9123#4567").valid).toBe(false);
  });
  it("rejects the wrong number of digits", () => {
    expect(validatePhone("9123456").valid).toBe(false);
    expect(validatePhone("912345678").valid).toBe(false);
    expect(validatePhone("+65 9123 456").valid).toBe(false);
  });
  it.each(["01234567", "11234567", "21234567", "41234567", "51234567", "71234567"])(
    "rejects 8 digits starting with an unassigned or short-code digit: %s",
    (v) => {
      const r = validatePhone(v);
      expect(r.valid, v).toBe(false);
      expect(r.reason).toBeTruthy();
    },
  );
  it("rejects 8-digit numbers starting with 99", () => {
    const r = validatePhone("99123456");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/emergency/);
  });
  it("rejects a 1800 number with the wrong length", () => {
    expect(validatePhone("1800 765 432").valid).toBe(false);
  });
});
