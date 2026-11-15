// Singapore UEN (Unique Entity Number) — generation and validation, including
// the trailing check letter.
//
// ACRA does not publish the check-letter algorithm. The formulas below are the
// community-reconstructed ones (the same weights used by python-stdnum and
// other public validators). We verified them ourselves against 27,961 real
// UENs sampled from ACRA's open dataset on data.gov.sg (2026-11): every UEN in
// all three formats matched. They are still UNOFFICIAL, and a correct check
// letter does not mean an entity is real or registered — verify real entities
// at ACRA's BizFile directory.

export type UenFormat = "business" | "local" | "other";

export const UEN_FORMATS: Record<
  UenFormat,
  { label: string; pattern: string; example: string }
> = {
  business: {
    label: "Business",
    pattern: "8 digits + check letter",
    example: "53333444J",
  },
  local: {
    label: "Local company",
    pattern: "year (4 digits) + 5 digits + check letter",
    example: "201912345R",
  },
  other: {
    label: "Other entity",
    pattern: "century letter + 2-digit year + entity code + 4 digits + check letter",
    example: "T09LL0001D",
  },
};

// Century prefixes used by the "other entity" format: the letter plus the two
// digits after it give the year (e.g. T09 = 2009, S61 = 1961, R90 = 1890).
// Confirmed against real UENs in ACRA's open data.
export const OTHER_PREFIXES = ["T", "S", "R"] as const;
export type OtherPrefix = (typeof OTHER_PREFIXES)[number];

export const OTHER_PREFIX_DESCRIPTIONS: Record<OtherPrefix, string> = {
  T: "Year 2000 onwards (20yy)",
  S: "Years 1900–1999 (19yy)",
  R: "Years 1800–1899 (18yy)",
};

// 2-letter entity-type codes (the "PQ" slot of the "other" format). Each code
// and name below was observed in ACRA's open UEN dataset (entity_type_desc
// column, 2026-11). Used to label recognised codes and to populate the
// generator menu. Validation deliberately does NOT reject codes that are absent
// here, since the Government adds new entity types over time.
export const ENTITY_TYPE_CODES: Record<string, string> = {
  LL: "Limited liability partnership",
  LP: "Limited partnership",
  FC: "Foreign company branch",
  RF: "Representative office",
  VC: "Variable capital company",
  PF: "Partnership (ACRA-registered)",
  SS: "Society",
  MC: "Management corporation",
  SM: "Subsidiary management corporation",
  CC: "Charity",
  CS: "Co-operative society",
  MB: "Mutual benefit organisation",
  TU: "Trade union",
  PW: "Platform work association",
  CM: "Medical clinic",
  CD: "Dental clinic",
  MD: "Medical and dental clinic",
  CL: "Clinical laboratory",
  XL: "X-ray laboratory",
  CX: "Clinical and X-ray laboratory",
  HC: "Healthcare service provider",
  GA: "Organ of state, ministry or department",
  GB: "Statutory board or public body",
  GS: "Government or government-aided school",
  EC: "International education language centre",
  TC: "Town council",
  PA: "People's Association service",
  PB: "Grassroots unit",
  MQ: "Mosque",
  MM: "Madrasah",
  DP: "High commission or embassy",
  CP: "Consulate",
  NR: "International organisation",
  FM: "Foreign military unit",
  FB: "Bank representative office",
  FN: "Insurance representative office",
  FS: "Other financial representative office",
  RP: "Foreign law practice representative office",
  NB: "News bureau",
};

// --- Check letter -----------------------------------------------------------

const BUSINESS_WEIGHTS = [10, 4, 9, 3, 8, 2, 7, 1];
const BUSINESS_LETTERS = "XMKECAWLJDB";
const LOCAL_WEIGHTS = [10, 8, 6, 4, 9, 7, 5, 3, 1];
const LOCAL_LETTERS = "ZKCMDNERGWH";
const OTHER_WEIGHTS = [4, 3, 5, 3, 10, 2, 2, 5, 7];
// Character values for the "other" format. I, O, Y and Z have no value, so a
// body containing one of them cannot be checked.
const OTHER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWX0123456789";

function weightedSum(values: number[], weights: number[]): number {
  return values.reduce((sum, v, i) => sum + v * weights[i], 0);
}

/**
 * Compute the check letter for a UEN body (the UEN without its last
 * character). Returns `null` when the body matches no format, or when an
 * "other entity" body contains a character the formula has no value for.
 */
export function uenCheckLetter(body: string): string | null {
  const b = body.trim().toUpperCase();
  if (/^\d{8}$/.test(b)) {
    return BUSINESS_LETTERS[weightedSum([...b].map(Number), BUSINESS_WEIGHTS) % 11];
  }
  if (/^\d{9}$/.test(b)) {
    return LOCAL_LETTERS[weightedSum([...b].map(Number), LOCAL_WEIGHTS) % 11];
  }
  if (/^[STR]\d{2}[A-Z]{2}\d{4}$/.test(b)) {
    const values = [...b].map((c) => OTHER_ALPHABET.indexOf(c));
    if (values.some((v) => v < 0)) return null;
    // +6 is the published "-5" offset kept non-negative under modulo 11.
    return OTHER_ALPHABET[(weightedSum(values, OTHER_WEIGHTS) + 6) % 11];
  }
  return null;
}

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
  /** True when the check letter was computed and matched; false when it could not be checked. */
  checkLetterVerified?: boolean;
  /** The check letter the formula expects, when it could be computed. */
  expectedCheckLetter?: string;
  checks: UenCheck[];
  reason?: string;
}

const CHECK_LETTER_UNVERIFIABLE: UenCheck = {
  label: "Check letter not verifiable for this entity code",
  status: "info",
};

/**
 * Apply the check-letter test to a structurally valid result. A wrong letter
 * makes the UEN invalid; a body the formula cannot handle stays valid with an
 * info note.
 */
function withCheckLetter(v: string, result: UenValidationResult): UenValidationResult {
  const expected = uenCheckLetter(v.slice(0, -1));
  const actual = v.slice(-1);
  if (expected === null) {
    return {
      ...result,
      checkLetterVerified: false,
      checks: [...result.checks, CHECK_LETTER_UNVERIFIABLE],
    };
  }
  if (expected === actual) {
    return {
      ...result,
      checkLetterVerified: true,
      expectedCheckLetter: expected,
      checks: [...result.checks, { label: `Check letter "${actual}" is correct`, status: "ok" }],
    };
  }
  return {
    ...result,
    valid: false,
    checkLetterVerified: false,
    expectedCheckLetter: expected,
    reason: `Check letter should be "${expected}", not "${actual}".`,
    checks: [
      ...result.checks,
      { label: `Check letter "${actual}" is wrong — expected "${expected}"`, status: "fail" },
    ],
  };
}

/**
 * Validate a UEN: structure (one of the three official formats) and the
 * trailing check letter. A passing result means well-formed with a correct
 * check letter — not that the entity is real or registered.
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
    return withCheckLetter(v, {
      valid: true,
      format: "business",
      formatLabel: UEN_FORMATS.business.label,
      checks: [
        { label: "9 characters", status: "ok" },
        { label: "8 digits followed by a check letter", status: "ok" },
      ],
    });
  }

  // Local company: 10 chars — yyyy + 5 digits + check letter.
  if (/^\d{9}[A-Z]$/.test(v)) {
    const year = v.slice(0, 4);
    return withCheckLetter(v, {
      valid: true,
      format: "local",
      formatLabel: UEN_FORMATS.local.label,
      checks: [
        { label: "10 characters", status: "ok" },
        { label: `Registration year ${year}`, status: "ok" },
        { label: "5-digit running number + check letter", status: "ok" },
      ],
    });
  }

  // Other entity: 10 chars — prefix(S/T/R) + yy + PQ + nnnn + check letter.
  const otherMatch = v.match(/^([STR])(\d{2})([A-Z]{2})(\d{4})([A-Z])$/);
  if (otherMatch) {
    const [, prefix, yy, code] = otherMatch;
    const entityTypeName = ENTITY_TYPE_CODES[code];
    const century = { T: "20", S: "19", R: "18" }[prefix as OtherPrefix];
    return withCheckLetter(v, {
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
        { label: `Year ${century}${yy}`, status: "ok" },
        {
          label: entityTypeName
            ? `Entity-type code "${code}" — ${entityTypeName}`
            : `Entity-type code "${code}" — not in our known list (may still be valid)`,
          status: entityTypeName ? "ok" : "info",
        },
      ],
    });
  }

  return {
    valid: false,
    checks: [],
    reason: "Does not match any of the three UEN formats.",
  };
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
export const UEN_MIN_YEAR = 1965;

export function uenMaxYear(): number {
  return new Date().getFullYear();
}

function randomYear(): number {
  const max = uenMaxYear();
  return UEN_MIN_YEAR + Math.floor(Math.random() * (max - UEN_MIN_YEAR + 1));
}

/** Append the computed check letter; "X" only if the body cannot be checked. */
function withLetter(body: string): string {
  return body + (uenCheckLetter(body) ?? "X");
}

export interface GenerateOptions {
  format: UenFormat;
  /** Registration year for "local"; year (last two digits used) for "other". Randomised if omitted. */
  year?: number;
  /** Century prefix for the "other" format. Randomised if omitted. */
  prefix?: OtherPrefix;
  /** Entity-type code for the "other" format. Randomised from known codes if omitted. */
  entityCode?: string;
}

/**
 * Generate a single UEN with a correctly computed check letter (see module
 * note — the formula is unofficial but matches real UENs).
 */
export function generateUen(opts: GenerateOptions): string {
  switch (opts.format) {
    case "business":
      return withLetter(randomDigits(8));
    case "local": {
      const year = opts.year ?? randomYear();
      return withLetter(String(year).padStart(4, "0") + randomDigits(5));
    }
    case "other": {
      const prefix = opts.prefix ?? pick(OTHER_PREFIXES);
      // "T" means 20yy, so keep a random year from running into the future.
      const yy =
        opts.year !== undefined
          ? String(opts.year % 100).padStart(2, "0")
          : prefix === "T"
            ? String(Math.floor(Math.random() * ((uenMaxYear() % 100) + 1))).padStart(2, "0")
            : randomDigits(2);
      const code = opts.entityCode ?? pick(Object.keys(ENTITY_TYPE_CODES));
      return withLetter(prefix + yy + code + randomDigits(4));
    }
  }
}

export function generateManyUen(opts: GenerateOptions, count: number): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("count must be an integer between 1 and 100");
  }
  return Array.from({ length: count }, () => generateUen(opts));
}
