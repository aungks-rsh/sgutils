// Singapore UEN (Unique Entity Number) — format generation and structural
// validation.
//
// IMPORTANT: ACRA does not publish the algorithm used to compute the trailing
// check letter of a UEN. Unlike NRIC/FIN, we therefore CANNOT verify (or
// correctly compute) the check letter. This module only deals with STRUCTURE —
// length, prefix, entity-type code, and character pattern. A structurally valid
// UEN is not necessarily real or registered. Verify real entities at ACRA's
// BizFile directory.

export type UenFormat = "business" | "local" | "other";

export const UEN_FORMATS: Record<
  UenFormat,
  { label: string; pattern: string; example: string }
> = {
  business: {
    label: "Business (pre-2009)",
    pattern: "8 digits + check letter",
    example: "53333444A",
  },
  local: {
    label: "Local company",
    pattern: "year (4 digits) + 5 digits + check letter",
    example: "201912345K",
  },
  other: {
    label: "Other entity",
    pattern: "prefix + 2-digit year + entity code + 4 digits + check letter",
    example: "T09LL0001B",
  },
};

// Century / issuance-era prefixes used by the "other entity" format.
export const OTHER_PREFIXES = ["S", "T", "R"] as const;
export type OtherPrefix = (typeof OTHER_PREFIXES)[number];

export const OTHER_PREFIX_DESCRIPTIONS: Record<OtherPrefix, string> = {
  S: "Issued before 2000 (19yy)",
  T: "Issued 2000–2020 (20yy)",
  R: "Issued from 2021 (20yy)",
};

// A subset of the 2-letter entity-type codes (the "PQ" slot of the "other"
// format) that we are confident about. Used to label recognised codes and to
// populate the generator menu. The full, authoritative list is maintained by
// the Singapore Government — validation deliberately does NOT reject codes that
// are absent here, since the list can grow over time.
export const ENTITY_TYPE_CODES: Record<string, string> = {
  LP: "Limited partnership",
  LL: "Limited liability partnership",
  FC: "Foreign company (branch)",
  PF: "Public accounting firm",
  RF: "Representative office",
};

export interface UenCheck {
  label: string;
  status: "ok" | "fail" | "info";
}

export interface UenValidationResult {
  valid: boolean;
  format?: UenFormat;
  formatLabel?: string;
  entityTypeCode?: string;
  entityTypeName?: string;
  checks: UenCheck[];
  reason?: string;
}

const CHECK_LETTER_INFO: UenCheck = {
  label: "Check letter not verifiable — ACRA's algorithm is unpublished",
  status: "info",
};

/**
 * Validate the STRUCTURE of a UEN. Returns `valid: true` when the input matches
 * one of the three official formats. The trailing check letter is never
 * verified (see module note); a passing result means well-formed, not real.
 */
export function validateUen(value: string): UenValidationResult {
  const v = value.trim().toUpperCase();
  if (v === "") {
    return { valid: false, checks: [], reason: "Enter a UEN to check." };
  }
  if (!/^[0-9A-Z]+$/.test(v)) {
    return {
      valid: false,
      checks: [],
      reason: "A UEN contains only letters and digits.",
    };
  }
  if (v.length !== 9 && v.length !== 10) {
    return {
      valid: false,
      checks: [],
      reason: `A UEN is 9 or 10 characters — got ${v.length}.`,
    };
  }

  // Business: 9 chars — 8 digits + check letter.
  if (/^\d{8}[A-Z]$/.test(v)) {
    return {
      valid: true,
      format: "business",
      formatLabel: UEN_FORMATS.business.label,
      checks: [
        { label: "9 characters", status: "ok" },
        { label: "8 digits followed by a check letter", status: "ok" },
        CHECK_LETTER_INFO,
      ],
    };
  }

  // Local company: 10 chars — yyyy + 5 digits + check letter.
  if (/^\d{9}[A-Z]$/.test(v)) {
    const year = v.slice(0, 4);
    return {
      valid: true,
      format: "local",
      formatLabel: UEN_FORMATS.local.label,
      checks: [
        { label: "10 characters", status: "ok" },
        { label: `Registration year ${year}`, status: "ok" },
        { label: "5-digit running number + check letter", status: "ok" },
        CHECK_LETTER_INFO,
      ],
    };
  }

  // Other entity: 10 chars — prefix(S/T/R) + yy + PQ + nnnn + check letter.
  const otherMatch = v.match(/^([STR])(\d{2})([A-Z]{2})(\d{4})([A-Z])$/);
  if (otherMatch) {
    const [, prefix, yy, code] = otherMatch;
    const entityTypeName = ENTITY_TYPE_CODES[code];
    return {
      valid: true,
      format: "other",
      formatLabel: UEN_FORMATS.other.label,
      entityTypeCode: code,
      entityTypeName,
      checks: [
        { label: "10 characters", status: "ok" },
        {
          label: `Prefix "${prefix}" — ${OTHER_PREFIX_DESCRIPTIONS[prefix as OtherPrefix]}`,
          status: "ok",
        },
        { label: `Issuance year ending in ${yy}`, status: "ok" },
        {
          label: entityTypeName
            ? `Entity-type code "${code}" — ${entityTypeName}`
            : `Entity-type code "${code}" — not in our known list (may still be valid)`,
          status: entityTypeName ? "ok" : "info",
        },
        CHECK_LETTER_INFO,
      ],
    };
  }

  return {
    valid: false,
    checks: [],
    reason: "Does not match any of the three UEN formats.",
  };
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomLetter(): string {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

function randomDigits(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Plausible registration-year range for the local-company format.
const MIN_YEAR = 1965;
const MAX_YEAR = 2025;

function randomYear(): number {
  return MIN_YEAR + Math.floor(Math.random() * (MAX_YEAR - MIN_YEAR + 1));
}

export interface GenerateOptions {
  format: UenFormat;
  /** Registration year for "local"; issuance year for "other". Randomised if omitted. */
  year?: number;
  /** Era prefix for the "other" format. Randomised if omitted. */
  prefix?: OtherPrefix;
  /** Entity-type code for the "other" format. Randomised from known codes if omitted. */
  entityCode?: string;
}

/**
 * Generate a single structurally-valid UEN. The trailing check letter is a
 * random placeholder — it is NOT a computed checksum (see module note).
 */
export function generateUen(opts: GenerateOptions): string {
  switch (opts.format) {
    case "business":
      return randomDigits(8) + randomLetter();
    case "local": {
      const year = opts.year ?? randomYear();
      return String(year).padStart(4, "0") + randomDigits(5) + randomLetter();
    }
    case "other": {
      const prefix = opts.prefix ?? pick(OTHER_PREFIXES);
      const yy =
        opts.year !== undefined
          ? String(opts.year % 100).padStart(2, "0")
          : randomDigits(2);
      const code = opts.entityCode ?? pick(Object.keys(ENTITY_TYPE_CODES));
      return prefix + yy + code + randomDigits(4) + randomLetter();
    }
  }
}

export function generateManyUen(opts: GenerateOptions, count: number): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("count must be an integer between 1 and 100");
  }
  return Array.from({ length: count }, () => generateUen(opts));
}
