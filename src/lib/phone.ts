// Singapore phone numbers — generation and format validation.
//
// Rules follow IMDA's National Numbering Plan (Issue 2, February 2026):
//   - National numbers are 8 digits; the first digit gives the service.
//       3 = IP telephony (IPT) and user-centric data-only (UCDO)
//       6 = fixed line (PSTN) and IP telephony
//       8, 9 = mobile ("Radio Network")
//     0 and 1 are short codes, 7 is 5-digit SMS short codes, and 2, 4 and 5
//     are reserved for future use.
//   - Numbers beginning with 99 are reserved for 3-digit emergency codes
//     (999 police, 995 fire/ambulance), so no 8-digit number starts with 99.
//   - 1800 + 7 digits (11 digits) is local toll-free; 1900 + 7 digits (11
//     digits) is premium rate; 800 + 7 digits (10 digits) is international
//     toll-free.
//
// There is no checksum, and Singapore has no range set aside for fictional
// numbers. This module checks FORMAT only: a valid result does not mean a
// number is in service, and a generated number can belong to a real person.

export type PhoneType =
  | "mobile"
  | "landline"
  | "voip"
  | "tollfree"
  | "premium"
  | "intl-tollfree"
  | "emergency";

export const PHONE_TYPE_LABELS: Record<PhoneType, string> = {
  mobile: "Mobile",
  landline: "Fixed line",
  voip: "IP telephony (VoIP)",
  tollfree: "Local toll-free (1800)",
  premium: "Premium rate (1900)",
  "intl-tollfree": "International toll-free (800)",
  emergency: "Emergency code",
};

/** Types the generator offers. */
export const GENERATABLE_TYPES = ["mobile", "landline", "voip", "tollfree"] as const;
export type GeneratableType = (typeof GENERATABLE_TYPES)[number];

export type PhoneFormat = "plain" | "spaced" | "intl" | "e164";

export const PHONE_FORMAT_LABELS: Record<PhoneFormat, string> = {
  plain: "91234567",
  spaced: "9123 4567",
  intl: "+65 9123 4567",
  e164: "+6591234567",
};

export interface PhoneCheck {
  label: string;
  status: "ok" | "fail" | "info";
}

export interface PhoneValidationResult {
  valid: boolean;
  type?: PhoneType;
  typeLabel?: string;
  /** Digits only, without the +65 country code. */
  national?: string;
  /** E.164 form (+65 followed by 8 digits). Only set for 8-digit numbers. */
  e164?: string;
  /** Conventional display form, e.g. "9123 4567" or "1800 765 4321". */
  formatted?: string;
  checks: PhoneCheck[];
  reason?: string;
}

const FIRST_DIGIT_REJECTIONS: Record<string, string> = {
  "0": "Numbers starting with 0 are 3-digit international call prefixes, not phone numbers.",
  "1": "Numbers starting with 1 are short service codes, or 1800/1900 numbers with 11 digits.",
  "2": "Numbers starting with 2 are reserved for future use.",
  "4": "Numbers starting with 4 are reserved for future use.",
  "5": "Numbers starting with 5 are reserved for future use.",
  "7": "Numbers starting with 7 are 5-digit SMS short codes, not phone numbers.",
};

function invalid(reason: string, checks: PhoneCheck[] = []): PhoneValidationResult {
  return { valid: false, checks, reason };
}

/** Group digits for display: 8 digits as 4+4, service numbers as prefix+3+4. */
function displayForm(national: string): string {
  if (national.length === 8) return `${national.slice(0, 4)} ${national.slice(4)}`;
  if (national.length === 11) {
    return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  }
  if (national.length === 10) {
    return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  return national;
}

/**
 * Format an 8-digit national number. Service numbers (1800/1900/800) and
 * emergency codes are not dialled with +65, so they always use their
 * conventional spaced form (or bare digits for "plain").
 */
export function formatPhone(national: string, format: PhoneFormat): string {
  if (national.length !== 8) {
    return format === "plain" ? national : displayForm(national);
  }
  switch (format) {
    case "plain":
      return national;
    case "spaced":
      return displayForm(national);
    case "intl":
      return `+65 ${displayForm(national)}`;
    case "e164":
      return `+65${national}`;
  }
}

/**
 * Validate the FORMAT of a Singapore phone number. Accepts spaces, hyphens,
 * dots and brackets, and an optional +65, 0065 or 65 country code.
 */
export function validatePhone(value: string): PhoneValidationResult {
  const raw = value.trim();
  if (raw === "") return invalid("Enter a phone number to check.");
  if (!/^\+?[\d\s\-().]+$/.test(raw)) {
    return invalid("A phone number contains only digits, spaces, hyphens and an optional leading +.");
  }

  let digits = raw.replace(/\D/g, "");
  const checks: PhoneCheck[] = [];
  let hadCountryCode = false;

  if (raw.startsWith("+")) {
    if (!digits.startsWith("65")) {
      return invalid("The country code is not +65, so this is not a Singapore number.");
    }
    digits = digits.slice(2);
    hadCountryCode = true;
  } else if (digits.startsWith("0065")) {
    digits = digits.slice(4);
    hadCountryCode = true;
  } else if (digits.length === 10 && digits.startsWith("65")) {
    digits = digits.slice(2);
    hadCountryCode = true;
  }
  if (hadCountryCode) checks.push({ label: "Country code 65 (Singapore)", status: "ok" });

  const done = (type: PhoneType, more: PhoneCheck[]): PhoneValidationResult => ({
    valid: true,
    type,
    typeLabel: PHONE_TYPE_LABELS[type],
    national: digits,
    e164: digits.length === 8 ? `+65${digits}` : undefined,
    formatted: displayForm(digits),
    checks: [
      ...checks,
      ...more,
      { label: "Format only — this does not show the number is in service", status: "info" },
    ],
  });

  if (digits.length === 3 && digits.startsWith("99")) {
    return done("emergency", [{ label: "3-digit emergency code (99X)", status: "ok" }]);
  }
  if (digits.length === 11 && digits.startsWith("1800")) {
    return done("tollfree", [
      { label: "11 digits", status: "ok" },
      { label: "1800 access code + 7-digit number", status: "ok" },
    ]);
  }
  if (digits.length === 11 && digits.startsWith("1900")) {
    return done("premium", [
      { label: "11 digits", status: "ok" },
      { label: "1900 access code + 7-digit number", status: "ok" },
    ]);
  }
  if (digits.length === 10 && digits.startsWith("800")) {
    return done("intl-tollfree", [
      { label: "10 digits", status: "ok" },
      { label: "800 access code + 7-digit number", status: "ok" },
    ]);
  }

  if (digits.length !== 8) {
    return invalid(
      `A Singapore phone number has 8 digits — got ${digits.length}.`,
      checks,
    );
  }

  const first = digits[0];
  if (first in FIRST_DIGIT_REJECTIONS) {
    return invalid(FIRST_DIGIT_REJECTIONS[first], checks);
  }
  if (digits.startsWith("99")) {
    return invalid(
      "Numbers starting with 99 are reserved for 3-digit emergency codes such as 999 and 995.",
      checks,
    );
  }

  const eight: PhoneCheck = { label: "8 digits", status: "ok" };
  if (first === "8" || first === "9") {
    return done("mobile", [eight, { label: `Starts with ${first} — mobile`, status: "ok" }]);
  }
  if (first === "6") {
    return done("landline", [
      eight,
      { label: "Starts with 6 — fixed line (can also be IP telephony)", status: "ok" },
    ]);
  }
  return done("voip", [eight, { label: "Starts with 3 — IP telephony", status: "ok" }]);
}

function randomDigits(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export interface GeneratePhoneOptions {
  type: GeneratableType;
  format?: PhoneFormat;
}

/** Generate the national digits (no formatting) for a number of the given type. */
export function generateNational(type: GeneratableType): string {
  switch (type) {
    case "mobile": {
      // 9 is followed by 0–8 (99 is emergency). For 8 we also skip a second
      // digit of 0 so a generated number never begins with the 800 prefix.
      const first = Math.random() < 0.5 ? "8" : "9";
      const second = first === "9" ? randomInt(0, 8) : randomInt(1, 9);
      return first + second + randomDigits(6);
    }
    case "landline":
      return "6" + randomDigits(7);
    case "voip":
      return "3" + randomDigits(7);
    case "tollfree":
      // Avoid the specially managed 1800 0…, 1800 1… and 1800 99… ranges.
      return "1800" + randomInt(2, 8) + randomDigits(6);
  }
}

/** Generate one format-valid Singapore phone number. */
export function generatePhone(opts: GeneratePhoneOptions): string {
  return formatPhone(generateNational(opts.type), opts.format ?? "plain");
}

export function generateManyPhones(opts: GeneratePhoneOptions, count: number): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("count must be an integer between 1 and 100");
  }
  return Array.from({ length: count }, () => generatePhone(opts));
}
