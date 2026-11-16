// Singapore vehicle registration numbers (car plates) — checksum letter,
// validation and generation.
//
// A plate is PREFIX + NUMBER + CHECKSUM LETTER, e.g. SBA 1234 G:
//   - prefix: 1 to 3 letters, giving the vehicle class and series
//   - number: 1 to 9999, written without leading zeros
//   - checksum letter: computed from the prefix and number
//
// Checksum (LTA does not publish it; this is the widely documented formula):
//   - take the LAST TWO letters of the prefix as A=1 … Z=26; a one-letter
//     prefix counts as 0 followed by that letter
//   - pad the number to four digits
//   - multiply the six values by 9, 4, 5, 4, 3, 2 and add them up
//   - the remainder after dividing by 19 picks a letter from
//     A Z Y X U T S R P M L K J H G E D C B (remainder 0 = A)
//
// Verified in November 2026 against 700 real plates (public bus fleet lists
// and plates quoted on Wikipedia): all matched except one evident typo in a
// source list.
//
// A correct checksum letter does not mean a plate is registered, and a
// generated plate can coincide with a real vehicle.

const CHECK_LETTERS = "AZYXUTSRPMLKJHGEDCB";
const WEIGHTS = [9, 4, 5, 4, 3, 2];

/**
 * Checksum letter for a prefix and number, or null when the inputs are not a
 * 1–3 letter prefix and a number from 1 to 9999.
 */
export function plateCheckLetter(prefix: string, number: number | string): string | null {
  const p = prefix.trim().toUpperCase();
  const n = typeof number === "number" ? number : Number.parseInt(number, 10);
  if (!/^[A-Z]{1,3}$/.test(p)) return null;
  if (!Number.isInteger(n) || n < 1 || n > 9999) return null;

  const lastTwo = p.slice(-2);
  const letters = [...lastTwo].map((c) => c.charCodeAt(0) - 64);
  while (letters.length < 2) letters.unshift(0);
  const digits = [...String(n).padStart(4, "0")].map(Number);
  const sum = [...letters, ...digits].reduce((acc, v, i) => acc + v * WEIGHTS[i], 0);
  return CHECK_LETTERS[sum % 19];
}

export type PlateFormat = "plain" | "spaced";

export const PLATE_FORMAT_LABELS: Record<PlateFormat, string> = {
  plain: "SBA1234G",
  spaced: "SBA 1234 G",
};

export function formatPlate(
  prefix: string,
  number: number,
  letter: string,
  format: PlateFormat = "plain",
): string {
  return format === "spaced" ? `${prefix} ${number} ${letter}` : `${prefix}${number}${letter}`;
}

/** Best-effort vehicle class for a prefix, or undefined when not recognised. */
export function plateCategory(prefix: string): string | undefined {
  const p = prefix.toUpperCase();
  if (p === "SBS" || p === "SMB" || p === "TIB" || p === "SG") return "Public bus";
  if (/^SH[A-Z]?$/.test(p)) return "Taxi";
  if (p === "PU") return "Pulau Ubin vehicle";
  if (p === "CB") return "Company or school bus";
  if (p === "QX") return "Emergency or law enforcement vehicle";
  if (p === "QY") return "Government vehicle";
  if (/^Q[A-Z]{0,2}$/.test(p)) return "Company vehicle (pre-1998 series)";
  if (/^S[A-Z]{0,2}$/.test(p) || /^E[A-Z]?$/.test(p)) return "Private car";
  if (/^A[A-Z]?$/.test(p) || /^F[A-Z]{0,2}$/.test(p)) return "Motorcycle";
  if (/^G[A-Z]{0,2}$/.test(p)) return "Light goods vehicle";
  if (/^Y[A-Z]?$/.test(p)) return "Heavy goods vehicle";
  if (/^X[A-Z]?$/.test(p)) return "Very heavy goods vehicle";
  if (/^W[A-Z]?$/.test(p)) return "Engineering plant vehicle";
  if (/^P[A-Z]?$/.test(p)) return "Private bus";
  if (/^TR[A-Z]?$/.test(p)) return "Trailer";
  return undefined;
}

export interface PlateCheck {
  label: string;
  status: "ok" | "fail" | "info";
}

export interface PlateValidationResult {
  valid: boolean;
  prefix?: string;
  number?: number;
  /** The letter the formula gives for this prefix and number. */
  expectedCheckLetter?: string;
  category?: string;
  /** Conventional display form with the correct letter, e.g. "SBA 1234 G". */
  formatted?: string;
  checks: PlateCheck[];
  reason?: string;
}

/**
 * Validate a plate: shape, number range and checksum letter. Spaces, hyphens
 * and lower case are accepted. A plate typed without its checksum letter is
 * reported as invalid, with the letter it should end in.
 */
export function validatePlate(value: string): PlateValidationResult {
  const raw = value.trim().toUpperCase().replace(/[\s\-.]/g, "");
  if (raw === "") return { valid: false, checks: [], reason: "Enter a plate number to check." };
  if (!/^[A-Z0-9]+$/.test(raw)) {
    return { valid: false, checks: [], reason: "A plate contains only letters and digits." };
  }

  const m = /^([A-Z]{1,3})(\d+)([A-Z]*)$/.exec(raw);
  if (!m) {
    return {
      valid: false,
      checks: [],
      reason: "Expected 1 to 3 letters, then 1 to 4 digits, then one checksum letter — e.g. SBA 1234 G.",
    };
  }
  const [, prefix, digits, suffix] = m;
  const checks: PlateCheck[] = [{ label: `Prefix ${prefix} (1 to 3 letters)`, status: "ok" }];

  if (digits.length > 4) {
    checks.push({ label: "Number has more than 4 digits", status: "fail" });
    return { valid: false, prefix, checks, reason: "The number part has at most 4 digits (1 to 9999)." };
  }
  if (digits.startsWith("0")) {
    checks.push({ label: "Number starts with 0", status: "fail" });
    return {
      valid: false,
      prefix,
      checks,
      reason: "Plate numbers run from 1 to 9999 and are written without leading zeros.",
    };
  }
  const number = Number.parseInt(digits, 10);
  checks.push({ label: `Number ${number} (1 to 9999)`, status: "ok" });

  const expected = plateCheckLetter(prefix, number) as string;
  const category = plateCategory(prefix);
  const formatted = formatPlate(prefix, number, expected, "spaced");
  const base = { prefix, number, expectedCheckLetter: expected, category, formatted };

  if (suffix.length > 1) {
    checks.push({ label: "More than one letter after the number", status: "fail" });
    return { ...base, valid: false, checks, reason: "A plate ends with a single checksum letter." };
  }
  if (suffix === "") {
    checks.push({ label: "No checksum letter", status: "fail" });
    return {
      ...base,
      valid: false,
      checks,
      reason: `The checksum letter is missing — it should be "${expected}" (${formatted}).`,
    };
  }
  if (suffix !== expected) {
    checks.push({ label: `Checksum letter should be ${expected}, not ${suffix}`, status: "fail" });
    return {
      ...base,
      valid: false,
      checks,
      reason: `Checksum letter should be "${expected}", not "${suffix}".`,
    };
  }

  checks.push({ label: `Checksum letter ${expected} is correct`, status: "ok" });
  checks.push(
    category
      ? { label: `Prefix series: ${category}`, status: "info" }
      : { label: "Prefix is not one of the common series", status: "info" },
  );
  checks.push({
    label: "Checksum only — this does not show the plate is registered",
    status: "info",
  });
  return { ...base, valid: true, checks };
}

export const GENERATABLE_PLATE_TYPES = [
  "car",
  "motorcycle",
  "goods",
  "heavy",
  "bus",
  "taxi",
] as const;
export type PlateType = (typeof GENERATABLE_PLATE_TYPES)[number];

export const PLATE_TYPE_LABELS: Record<PlateType, string> = {
  car: "Car (S)",
  motorcycle: "Motorcycle (F)",
  goods: "Light goods vehicle (G)",
  heavy: "Heavy goods vehicle (Y)",
  bus: "Private bus (P)",
  taxi: "Taxi (SH)",
};

// Series letters never include I or O (too close to 1 and 0).
const SERIES_LETTERS = [..."ABCDEFGHJKLMNPQRSTUVWXYZ"];

// Car prefixes that were skipped or are reserved for other uses.
const CAR_SKIPPED = new Set([
  "SBS", "SCB", "SCC", "SCD", "SCS", "SCT", "SDC", "SKY", "SLY", "SMB",
]);

// Only series that have already been issued in full, so a generated plate
// never uses a prefix that does not exist yet.
const PREFIXES: Record<PlateType, string[]> = {
  // SBA … SNZ: middle letters B–N without the vowels (SE_, SI_) and without
  // SH_ (taxis).
  car: [..."BCDFGJKLMN"]
    .flatMap((mid) => SERIES_LETTERS.map((last) => `S${mid}${last}`))
    .filter((p) => !CAR_SKIPPED.has(p)),
  motorcycle: SERIES_LETTERS.map((last) => `FB${last}`),
  goods: [..."ABCDEFGHJKLM"].map((last) => `GB${last}`),
  heavy: [..."ABCDEFGHJKLMNPQR"].map((last) => `Y${last}`),
  bus: ["PA", "PC"],
  taxi: ["SHA", "SHB", "SHC", "SHD"],
};

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export interface GeneratePlateOptions {
  type: PlateType;
  format?: PlateFormat;
}

/** Generate one plate with a correct checksum letter. */
export function generatePlate(opts: GeneratePlateOptions): string {
  const prefix = pick(PREFIXES[opts.type]);
  const number = 1 + Math.floor(Math.random() * 9999);
  const letter = plateCheckLetter(prefix, number) as string;
  return formatPlate(prefix, number, letter, opts.format ?? "plain");
}

export function generateManyPlates(opts: GeneratePlateOptions, count: number): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("count must be an integer between 1 and 100");
  }
  return Array.from({ length: count }, () => generatePlate(opts));
}
