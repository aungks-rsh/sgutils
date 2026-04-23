export type IdPrefix = "S" | "T" | "F" | "G" | "M";
export type IdKind = "NRIC" | "FIN";

export interface ValidationResult {
  valid: boolean;
  kind?: IdKind;
  prefix?: IdPrefix;
  reason?: string;
}

const WEIGHTS = [2, 7, 6, 5, 4, 3, 2] as const;

const CHECKSUM_TABLES: Record<IdPrefix, readonly string[]> = {
  S: ["J", "Z", "I", "H", "G", "F", "E", "D", "C", "B", "A"],
  T: ["J", "Z", "I", "H", "G", "F", "E", "D", "C", "B", "A"],
  F: ["X", "W", "U", "T", "R", "Q", "P", "N", "M", "L", "K"],
  G: ["X", "W", "U", "T", "R", "Q", "P", "N", "M", "L", "K"],
  M: ["K", "L", "J", "N", "P", "Q", "R", "T", "U", "W", "X"],
};

const OFFSETS: Record<IdPrefix, number> = {
  S: 0,
  T: 4,
  F: 0,
  G: 4,
  M: 3,
};

const NRIC_PREFIXES = new Set<IdPrefix>(["S", "T"]);

export const PREFIX_DESCRIPTIONS: Record<IdPrefix, string> = {
  S: "Singapore citizens/PR born before 2000",
  T: "Singapore citizens/PR born 2000 or later",
  F: "Foreigners (FIN) issued before 2000",
  G: "Foreigners (FIN) issued 2000–2021",
  M: "Foreigners (FIN) issued from 2022",
};

function checksumLetter(prefix: IdPrefix, digits: string): string {
  if (!/^\d{7}$/.test(digits)) {
    throw new Error("digits must be exactly 7 numeric characters");
  }
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += Number(digits[i]) * WEIGHTS[i];
  }
  sum += OFFSETS[prefix];
  return CHECKSUM_TABLES[prefix][sum % 11];
}

export function generateId(prefix: IdPrefix): string {
  let digits = "";
  for (let i = 0; i < 7; i++) {
    digits += Math.floor(Math.random() * 10).toString();
  }
  return `${prefix}${digits}${checksumLetter(prefix, digits)}`;
}

export function generateMany(prefix: IdPrefix, count: number): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("count must be an integer between 1 and 100");
  }
  return Array.from({ length: count }, () => generateId(prefix));
}

export function validate(value: string): ValidationResult {
  const normalized = value.trim().toUpperCase();
  if (!/^[STFGM]\d{7}[A-Z]$/.test(normalized)) {
    return {
      valid: false,
      reason: "Format must be a letter (S/T/F/G/M) + 7 digits + 1 letter",
    };
  }
  const prefix = normalized[0] as IdPrefix;
  const digits = normalized.slice(1, 8);
  const given = normalized[8];
  const expected = checksumLetter(prefix, digits);
  if (given !== expected) {
    return {
      valid: false,
      prefix,
      reason: `Checksum mismatch (expected ${expected}, got ${given})`,
    };
  }
  return {
    valid: true,
    kind: NRIC_PREFIXES.has(prefix) ? "NRIC" : "FIN",
    prefix,
  };
}
