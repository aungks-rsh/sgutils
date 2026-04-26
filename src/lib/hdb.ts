export type LoanType = "bank" | "hdb";

export interface HdbCalculatorInput {
  price: number;
  cpfOa?: number;
  age?: number;
  loanType: LoanType;
  buyerHasOwnAgent?: boolean;
}

export interface BsdBreakdown {
  tier1: number;
  tier2: number;
  tier3: number;
  tier4: number;
  tier5: number;
  tier6: number;
  total: number;
}

export interface HdbCalculatorResult {
  loanType: LoanType;
  price: number;
  loanAmount: number;
  cashDown: number;
  cashDownMinCash: number;
  cashDownCpfPayable: number;
  bsd: BsdBreakdown;
  legalFee: number;
  valuationFee: number;
  fireInsurance: number;
  mortgageStampDuty: number;
  agentFee: number;
  totalCashdown: number;
  cpfEligibleTotal: number;
  hardCashFloor: number;
  cpfApplied: number;
  cashNeeded: number;
  maxTenureFullLtv: number | null;
  maxTenureAbsolute: number | null;
  fullLtvCap: number;
  absoluteCap: number;
  ageUsed: number | null;
}

export interface TenureLimits {
  fullLtvMax: number;
  absoluteMax: number;
  fullLtvCap: number;
  absoluteCap: number;
}

const LTV = 0.75;

const TENURE_FULLLTV_CAP = 25;
const TENURE_ABSOLUTE_CAP_BANK = 30;
const TENURE_ABSOLUTE_CAP_HDB = 25;
const AGE_TENURE_CEILING = 65;

const FIXED_LEGAL_FEE = 1000;
const FIXED_VALUATION_FEE = 400;
const FIXED_FIRE_INSURANCE = 100;

const MORTGAGE_STAMP_RATE = 0.004;
const MORTGAGE_STAMP_CAP = 500;

const BANK_MIN_CASH_FRAC = 0.05;
const BANK_CPF_FRAC = 0.20;
const HDB_CPF_FRAC = 0.25;

const AGENT_FEE_RATE = 0.01;

export function calcBsd(price: number): BsdBreakdown {
  const p = Math.max(0, price);
  const tier1 = Math.min(180_000, p) * 0.01;
  const tier2 = Math.max(Math.min(p - 180_000, 180_000), 0) * 0.02;
  const tier3 = Math.max(Math.min(p - 360_000, 640_000), 0) * 0.03;
  const tier4 = Math.max(Math.min(p - 1_000_000, 500_000), 0) * 0.04;
  const tier5 = Math.max(Math.min(p - 1_500_000, 1_500_000), 0) * 0.05;
  const tier6 = Math.max(p - 3_000_000, 0) * 0.06;
  return {
    tier1,
    tier2,
    tier3,
    tier4,
    tier5,
    tier6,
    total: tier1 + tier2 + tier3 + tier4 + tier5 + tier6,
  };
}

export function calcTenureLimits(
  age: number | null,
  loanType: LoanType,
): TenureLimits {
  const fullLtvCap = TENURE_FULLLTV_CAP;
  const absoluteCap =
    loanType === "bank" ? TENURE_ABSOLUTE_CAP_BANK : TENURE_ABSOLUTE_CAP_HDB;
  if (age === null) {
    return {
      fullLtvMax: fullLtvCap,
      absoluteMax: absoluteCap,
      fullLtvCap,
      absoluteCap,
    };
  }
  const ageRoom = Math.max(0, AGE_TENURE_CEILING - age);
  return {
    fullLtvMax: Math.min(fullLtvCap, ageRoom),
    absoluteMax: Math.min(absoluteCap, ageRoom),
    fullLtvCap,
    absoluteCap,
  };
}

export function calculate(input: HdbCalculatorInput): HdbCalculatorResult {
  const price = Math.max(0, input.price || 0);
  const cpfOa = Math.max(0, input.cpfOa || 0);
  const loanType = input.loanType;
  const buyerHasOwnAgent = input.buyerHasOwnAgent ?? false;

  const cashDown = price * (1 - LTV);
  const loanAmount = price - cashDown;

  const cashDownMinCash =
    loanType === "bank" ? price * BANK_MIN_CASH_FRAC : 0;
  const cashDownCpfPayable =
    loanType === "bank" ? price * BANK_CPF_FRAC : price * HDB_CPF_FRAC;

  const bsd = calcBsd(price);

  const mortgageStampDuty = Math.min(
    loanAmount * MORTGAGE_STAMP_RATE,
    MORTGAGE_STAMP_CAP,
  );
  const agentFee = buyerHasOwnAgent ? price * AGENT_FEE_RATE : 0;

  const totalCashdown =
    cashDown +
    bsd.total +
    FIXED_LEGAL_FEE +
    FIXED_VALUATION_FEE +
    FIXED_FIRE_INSURANCE +
    mortgageStampDuty +
    agentFee;

  const cpfEligibleTotal =
    cashDownCpfPayable +
    bsd.total +
    FIXED_LEGAL_FEE +
    FIXED_VALUATION_FEE +
    mortgageStampDuty;

  const hardCashFloor = cashDownMinCash + FIXED_FIRE_INSURANCE + agentFee;

  const cpfApplied = Math.min(cpfOa, cpfEligibleTotal);
  const cashNeeded = Math.max(0, totalCashdown - cpfApplied);

  const ageUsed =
    typeof input.age === "number" && input.age > 0 && input.age < AGE_TENURE_CEILING
      ? Math.floor(input.age)
      : null;
  const tenureLimits = calcTenureLimits(ageUsed, loanType);

  return {
    loanType,
    price,
    loanAmount,
    cashDown,
    cashDownMinCash,
    cashDownCpfPayable,
    bsd,
    legalFee: FIXED_LEGAL_FEE,
    valuationFee: FIXED_VALUATION_FEE,
    fireInsurance: FIXED_FIRE_INSURANCE,
    mortgageStampDuty,
    agentFee,
    totalCashdown,
    cpfEligibleTotal,
    hardCashFloor,
    cpfApplied,
    cashNeeded,
    maxTenureFullLtv: ageUsed !== null ? tenureLimits.fullLtvMax : null,
    maxTenureAbsolute: ageUsed !== null ? tenureLimits.absoluteMax : null,
    fullLtvCap: tenureLimits.fullLtvCap,
    absoluteCap: tenureLimits.absoluteCap,
    ageUsed,
  };
}

export interface MortgageInput {
  loanAmount: number;
  annualRatePct: number;
  years: number;
}

export interface MortgageResult {
  monthlyPayment: number;
  firstMonthPrincipal: number;
  firstMonthInterest: number;
  totalPaid: number;
  totalInterest: number;
  months: number;
}

export const DEFAULT_RATE_HDB = 2.6;
export const DEFAULT_RATE_BANK = 3.0;

export function defaultRateFor(loanType: LoanType): number {
  return loanType === "hdb" ? DEFAULT_RATE_HDB : DEFAULT_RATE_BANK;
}

export function calcMortgage(input: MortgageInput): MortgageResult {
  const principal = Math.max(0, input.loanAmount);
  const annualRate = Math.max(0, input.annualRatePct) / 100;
  const years = Math.max(0, input.years);
  const n = Math.round(years * 12);
  const r = annualRate / 12;

  if (n === 0 || principal === 0) {
    return {
      monthlyPayment: 0,
      firstMonthPrincipal: 0,
      firstMonthInterest: 0,
      totalPaid: 0,
      totalInterest: 0,
      months: n,
    };
  }

  const monthlyPayment =
    r === 0
      ? principal / n
      : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const firstMonthInterest = principal * r;
  const firstMonthPrincipal = monthlyPayment - firstMonthInterest;
  const totalPaid = monthlyPayment * n;
  const totalInterest = totalPaid - principal;

  return {
    monthlyPayment,
    firstMonthPrincipal,
    firstMonthInterest,
    totalPaid,
    totalInterest,
    months: n,
  };
}

export function formatSgd(amount: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}
