export interface ParseResult {
  valid: boolean;
  ms?: number;
  error?: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const pad3 = (n: number) => String(n).padStart(3, "0");

const SGT_OFFSET_MINUTES = 8 * 60;

function formatParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
): string {
  return `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}.${pad3(ms)}`;
}

export function formatUtc(ms: number): string {
  const d = new Date(ms);
  return formatParts(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  );
}

export function formatSgt(ms: number): string {
  const d = new Date(ms + SGT_OFFSET_MINUTES * 60 * 1000);
  return formatParts(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  );
}

export function formatLocal(ms: number): string {
  const d = new Date(ms);
  return formatParts(
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}

export function formatIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function localTimezoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
  } catch {
    return "Local";
  }
}

export function localOffsetLabel(ms: number): string {
  const offset = -new Date(ms).getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `UTC${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function localDiffersFromSgt(ms: number): boolean {
  return -new Date(ms).getTimezoneOffset() !== SGT_OFFSET_MINUTES;
}

export function formatRelative(ms: number, nowMs: number = Date.now()): string {
  const diff = ms - nowMs;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 60 * 60 * 1000],
    ["month", 30 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
    ["second", 1000],
  ];
  for (const [unit, size] of units) {
    if (abs >= size) {
      const value = Math.round(diff / size);
      return rtf.format(value, unit);
    }
  }
  return "just now";
}

function appendSgtOffset(iso: string): string {
  if (/[Zz]$/.test(iso)) return iso;
  if (/[+-]\d{2}:?\d{2}$/.test(iso)) return iso;
  return `${iso}+08:00`;
}

export function parseDatetime(input: string): ParseResult {
  const s = input.trim();
  if (!s) return { valid: false, error: "Empty input" };

  // Unix timestamp (pure digits, optionally negative)
  if (/^-?\d+$/.test(s)) {
    const digits = s.replace(/^-/, "").length;
    const n = Number(s);
    if (!Number.isFinite(n)) {
      return { valid: false, error: "Number out of range" };
    }
    if (digits === 13) return { valid: true, ms: n };
    if (digits === 10) return { valid: true, ms: n * 1000 };
    if (digits < 10) return { valid: true, ms: n * 1000 };
    return {
      valid: false,
      error: `Ambiguous ${digits}-digit number. Use 10 digits for seconds or 13 for milliseconds.`,
    };
  }

  // DD/MM/YYYY [HH:mm[:ss[.fff]]]
  const sg = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/,
  );
  if (sg) {
    const dd = +sg[1];
    const mm = +sg[2];
    const yyyy = +sg[3];
    const hh = sg[4] ? +sg[4] : 0;
    const mn = sg[5] ? +sg[5] : 0;
    const ss = sg[6] ? +sg[6] : 0;
    const fff = sg[7] ? Number((sg[7] + "000").slice(0, 3)) : 0;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
      return { valid: false, error: "Invalid day/month" };
    }
    const iso = `${yyyy}-${pad2(mm)}-${pad2(dd)}T${pad2(hh)}:${pad2(mn)}:${pad2(ss)}.${pad3(fff)}+08:00`;
    const p = Date.parse(iso);
    if (!Number.isNaN(p)) return { valid: true, ms: p };
    return { valid: false, error: "Invalid date" };
  }

  // yyyy-MM-dd [HH:mm[:ss[.fff]]] (space or T), optional timezone
  const ymd = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (ymd) {
    const [, yyyy, mm, dd, hRaw, mn, ss, frac, tz] = ymd;
    const hh = hRaw ? pad2(+hRaw) : "00";
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${mn ?? "00"}:${ss ?? "00"}${frac ? `.${(frac + "000").slice(0, 3)}` : ""}${tz ?? "+08:00"}`;
    const p = Date.parse(iso);
    if (!Number.isNaN(p)) return { valid: true, ms: p };
    return { valid: false, error: "Invalid date" };
  }

  // Last resort: native parse, assume SGT if no timezone
  const normalized = appendSgtOffset(s);
  const p = Date.parse(normalized);
  if (!Number.isNaN(p)) return { valid: true, ms: p };

  return {
    valid: false,
    error: "Unrecognized format. Try Unix seconds/ms, ISO 8601, yyyy-MM-dd HH:mm:ss, or DD/MM/YYYY.",
  };
}
