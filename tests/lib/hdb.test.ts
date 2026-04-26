import { describe, it, expect } from "vitest";
import {
  calcBsd,
  calcMortgage,
  calcTenureLimits,
  calculate,
  defaultRateFor,
} from "../../src/lib/hdb";

describe("calcBsd — tiered Buyer's Stamp Duty", () => {
  it("computes BSD for 600k (matches user's xlsx baseline)", () => {
    const b = calcBsd(600_000);
    expect(b.tier1).toBe(1_800);
    expect(b.tier2).toBe(3_600);
    expect(b.tier3).toBe(7_200);
    expect(b.tier4).toBe(0);
    expect(b.tier5).toBe(0);
    expect(b.tier6).toBe(0);
    expect(b.total).toBe(12_600);
  });

  it("computes BSD at $1M boundary", () => {
    const b = calcBsd(1_000_000);
    expect(b.tier1).toBe(1_800);
    expect(b.tier2).toBe(3_600);
    expect(b.tier3).toBe(19_200);
    expect(b.tier4).toBe(0);
    expect(b.total).toBe(24_600);
  });

  it("includes 4% tier above $1M", () => {
    const b = calcBsd(1_200_000);
    expect(b.tier4).toBe(8_000);
    expect(b.total).toBe(32_600);
  });

  it("includes 5% tier above $1.5M", () => {
    const b = calcBsd(2_000_000);
    expect(b.tier4).toBe(20_000);
    expect(b.tier5).toBe(25_000);
    expect(b.total).toBe(69_600);
  });

  it("includes 6% tier above $3M", () => {
    const b = calcBsd(4_000_000);
    expect(b.tier6).toBe(60_000);
  });

  it("returns zero for non-positive price", () => {
    expect(calcBsd(0).total).toBe(0);
    expect(calcBsd(-1).total).toBe(0);
  });
});

describe("calcTenureLimits", () => {
  it("returns 25y full-LTV cap and 30y absolute cap for young bank-loan buyer", () => {
    const t = calcTenureLimits(25, "bank");
    expect(t.fullLtvMax).toBe(25);
    expect(t.absoluteMax).toBe(30);
    expect(t.fullLtvCap).toBe(25);
    expect(t.absoluteCap).toBe(30);
  });

  it("returns 25y for HDB loan (no reduced-LTV zone)", () => {
    const t = calcTenureLimits(25, "hdb");
    expect(t.fullLtvMax).toBe(25);
    expect(t.absoluteMax).toBe(25);
  });

  it("uses 65-age when older buyer hits the age constraint", () => {
    const t = calcTenureLimits(45, "bank");
    expect(t.fullLtvMax).toBe(20);
    expect(t.absoluteMax).toBe(20);
  });

  it("never returns negative when age >= 65", () => {
    const t = calcTenureLimits(70, "bank");
    expect(t.fullLtvMax).toBe(0);
    expect(t.absoluteMax).toBe(0);
  });

  it("returns the static caps when age is null", () => {
    const t = calcTenureLimits(null, "bank");
    expect(t.fullLtvMax).toBe(25);
    expect(t.absoluteMax).toBe(30);
  });
});

describe("calculate — bank loan, 600k baseline (with corrections)", () => {
  const r = calculate({
    price: 600_000,
    cpfOa: 130_000,
    loanType: "bank",
    buyerHasOwnAgent: true,
  });

  it("produces correct cash down and loan", () => {
    expect(r.cashDown).toBe(150_000);
    expect(r.loanAmount).toBe(450_000);
  });

  it("splits cash down into 5% min cash + 20% CPF (bank rules)", () => {
    expect(r.cashDownMinCash).toBe(30_000);
    expect(r.cashDownCpfPayable).toBe(120_000);
  });

  it("caps mortgage stamp duty at $500", () => {
    expect(r.mortgageStampDuty).toBe(500);
  });

  it("includes 1% agent fee when buyer has own agent", () => {
    expect(r.agentFee).toBe(6_000);
  });

  it("totals all cashdown components", () => {
    expect(r.totalCashdown).toBe(170_600);
  });

  it("subtracts CPF OA from total when below eligibility cap", () => {
    expect(r.cpfApplied).toBe(130_000);
    expect(r.cashNeeded).toBe(40_600);
  });

  it("computes CPF eligibility (cash-down CPF + BSD + legal + val + mortgage stamp)", () => {
    expect(r.cpfEligibleTotal).toBe(120_000 + 12_600 + 1_000 + 400 + 500);
  });

  it("computes hard cash floor (5% min cash + fire insurance + agent fee)", () => {
    expect(r.hardCashFloor).toBe(30_000 + 100 + 6_000);
  });
});

describe("calculate — CPF cap behavior", () => {
  it("caps CPF at eligibility when OA exceeds it (bank loan)", () => {
    const r = calculate({
      price: 600_000,
      cpfOa: 300_000,
      loanType: "bank",
      buyerHasOwnAgent: true,
    });
    expect(r.cpfEligibleTotal).toBe(134_500);
    expect(r.cpfApplied).toBe(134_500);
    expect(r.cashNeeded).toBe(36_100);
    expect(r.cashNeeded).toBe(r.hardCashFloor);
  });

  it("caps CPF at eligibility for HDB loan (only fire insurance left as cash)", () => {
    const r = calculate({
      price: 600_000,
      cpfOa: 500_000,
      loanType: "hdb",
    });
    expect(r.cpfEligibleTotal).toBe(150_000 + 12_600 + 1_000 + 400 + 500);
    expect(r.hardCashFloor).toBe(100);
    expect(r.cashNeeded).toBe(100);
  });

  it("uses available CPF when below eligibility", () => {
    const r = calculate({
      price: 600_000,
      cpfOa: 50_000,
      loanType: "bank",
    });
    expect(r.cpfApplied).toBe(50_000);
    expect(r.cashNeeded).toBe(r.totalCashdown - 50_000);
  });
});

describe("calculate — HDB loan differences", () => {
  const r = calculate({
    price: 600_000,
    loanType: "hdb",
  });

  it("requires no min cash for HDB loan", () => {
    expect(r.cashDownMinCash).toBe(0);
  });

  it("allows full 25% cash down via CPF", () => {
    expect(r.cashDownCpfPayable).toBe(150_000);
  });

  it("defaults agent fee to 0", () => {
    expect(r.agentFee).toBe(0);
  });

  it("uses HDB tenure cap (25y) when age provided", () => {
    const withAge = calculate({ price: 600_000, age: 30, loanType: "hdb" });
    expect(withAge.absoluteCap).toBe(25);
    expect(withAge.maxTenureFullLtv).toBe(25);
    expect(withAge.maxTenureAbsolute).toBe(25);
  });
});

describe("calculate — age handling", () => {
  it("returns null tenure when age is missing", () => {
    const r = calculate({ price: 500_000, loanType: "bank" });
    expect(r.ageUsed).toBeNull();
    expect(r.maxTenureFullLtv).toBeNull();
    expect(r.maxTenureAbsolute).toBeNull();
  });

  it("limits both full-LTV and absolute tenure for older buyers", () => {
    const r = calculate({ price: 500_000, age: 50, loanType: "bank" });
    expect(r.maxTenureFullLtv).toBe(15);
    expect(r.maxTenureAbsolute).toBe(15);
  });

  it("bank loan keeps full-LTV cap at 25y but absolute at 30y for young buyer", () => {
    const r = calculate({ price: 500_000, age: 30, loanType: "bank" });
    expect(r.maxTenureFullLtv).toBe(25);
    expect(r.maxTenureAbsolute).toBe(30);
  });
});

describe("calculate — edge cases", () => {
  it("handles zero price", () => {
    const r = calculate({ price: 0, loanType: "bank" });
    expect(r.totalCashdown).toBe(1_500);
    expect(r.cashNeeded).toBe(1_500);
  });

  it("respects hard cash floor when CPF OA exceeds eligibility", () => {
    const r = calculate({ price: 300_000, cpfOa: 1_000_000, loanType: "hdb" });
    expect(r.cashNeeded).toBe(r.hardCashFloor);
    expect(r.cashNeeded).toBeGreaterThanOrEqual(0);
  });
});

describe("calcMortgage — amortized monthly payment", () => {
  it("matches standard amortization formula (450k @ 3% over 25y)", () => {
    const m = calcMortgage({ loanAmount: 450_000, annualRatePct: 3, years: 25 });
    expect(m.monthlyPayment).toBeCloseTo(2_133.95, 1);
    expect(m.months).toBe(300);
  });

  it("computes first month interest as principal × monthly rate", () => {
    const m = calcMortgage({ loanAmount: 450_000, annualRatePct: 2.6, years: 25 });
    expect(m.firstMonthInterest).toBeCloseTo(450_000 * (0.026 / 12), 4);
  });

  it("first month principal = monthly - first month interest", () => {
    const m = calcMortgage({ loanAmount: 450_000, annualRatePct: 2.6, years: 25 });
    expect(m.firstMonthPrincipal + m.firstMonthInterest).toBeCloseTo(
      m.monthlyPayment,
      4,
    );
  });

  it("total interest = monthly × months - principal", () => {
    const m = calcMortgage({ loanAmount: 450_000, annualRatePct: 3, years: 25 });
    expect(m.totalInterest).toBeCloseTo(m.totalPaid - 450_000, 2);
    expect(m.totalPaid).toBeCloseTo(m.monthlyPayment * m.months, 2);
  });

  it("handles zero rate (linear amortization)", () => {
    const m = calcMortgage({ loanAmount: 360_000, annualRatePct: 0, years: 30 });
    expect(m.monthlyPayment).toBe(1_000);
    expect(m.totalInterest).toBe(0);
  });

  it("handles zero principal", () => {
    const m = calcMortgage({ loanAmount: 0, annualRatePct: 3, years: 25 });
    expect(m.monthlyPayment).toBe(0);
    expect(m.totalPaid).toBe(0);
  });

  it("handles zero years", () => {
    const m = calcMortgage({ loanAmount: 100_000, annualRatePct: 3, years: 0 });
    expect(m.monthlyPayment).toBe(0);
    expect(m.months).toBe(0);
  });
});

describe("defaultRateFor", () => {
  it("returns 2.6 for HDB loan", () => {
    expect(defaultRateFor("hdb")).toBe(2.6);
  });
  it("returns 3.0 for bank loan", () => {
    expect(defaultRateFor("bank")).toBe(3.0);
  });
});
