import type { BudgetPosition, Transaction, NWPosition, AssetCategory, LiabilityCategory, BudgetSection, Settings, Projection, ExtraCashFlow } from "./types";

export const fmt = (n: number, dec = 0) =>
  (n < 0 ? "-" : "") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const money = (n: number) => fmt(n, 0);
export const pct = (n: number, dec = 1) => `${(n * 100).toFixed(dec)}%`;

export function effectiveDate(date: string, settings: Settings, type: string): string {
  if (!settings.shiftLateIncome || type !== "Income") return date;
  const [y, m, d] = date.split("-").map(Number);
  if (d < settings.lateIncomeDay) return date;
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

export function monthKey(date: string): string { return date.slice(0, 7); }

export function sectionTotal(positions: BudgetPosition[], section: BudgetSection): number {
  return positions.filter(p => p.section === section).reduce((a, p) => a + p.monthly.reduce((x, y) => x + y, 0) / 12, 0);
}

export function actualsByPosition(txs: Transaction[], settings: Settings, period?: { from: string; to: string }) {
  const map = new Map<string, number>();
  txs.forEach(t => {
    if (!t.budgetPositionId) return;
    const ed = effectiveDate(t.date, settings, t.budgetType);
    if (period) { const mk = monthKey(ed); if (mk < period.from || mk > period.to) return; }
    const cur = map.get(t.budgetPositionId) || 0;
    map.set(t.budgetPositionId, cur + Math.abs(t.amount));
  });
  return map;
}

export function nwTotals(positions: NWPosition[], month: string) {
  let assets = 0, liab = 0;
  positions.forEach(p => {
    const v = p.balances[month] || 0;
    if (p.type === "Asset") assets += v; else liab += v;
  });
  return { assets, liab, net: assets - liab };
}

export function latestTrackedMonth(positions: NWPosition[], mode: "Lazy" | "Strict"): string | null {
  const allMonths = new Set<string>();
  positions.forEach(p => Object.keys(p.balances).forEach(m => allMonths.add(m)));
  const sorted = [...allMonths].sort();
  if (sorted.length === 0) return null;
  if (mode === "Lazy") {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const m = sorted[i];
      if (positions.some(p => p.balances[m] !== undefined && p.balances[m] !== 0)) return m;
    }
    return sorted[sorted.length - 1];
  } else {
    let last: string | null = null;
    for (const m of sorted) {
      const has = positions.some(p => p.balances[m] !== undefined && p.balances[m] !== 0);
      if (!has) break;
      last = m;
    }
    return last;
  }
}

export function projectNetWorth(p: Projection, startNW: number, extras: ExtraCashFlow[], startYear: number) {
  const out: { year: number; nw: number; income: number; expenses: number; surplus: number; assets: number; liab: number }[] = [];
  let nw = startNW;
  let assets = startNW > 0 ? startNW : 0;
  let liab = startNW < 0 ? -startNW : 0;
  for (let y = startYear; y <= p.endYear; y++) {
    const yearsFromStart = y - startYear;
    const isRetired = y >= p.retirementYear;
    const baseIncome = isRetired
      ? p.retirementIncome * Math.pow(1 + p.retirementGrowth/100, y - p.retirementYear)
      : p.initialIncome * Math.pow(1 + p.incomeGrowth/100, yearsFromStart);
    const baseExpenses = p.initialExpenses * Math.pow(1 + p.inflation/100, yearsFromStart);
    let extraIn = 0, extraOut = 0;
    extras.forEach(e => {
      if (!e.include) return;
      if (y < e.startYear || y > e.lastYear) return;
      const amt = e.amount * Math.pow(1 + e.growth/100, y - e.startYear);
      if (e.type === "Income") extraIn += amt;
      else if (e.type === "Expenses") extraOut += amt;
    });
    const income = baseIncome + extraIn;
    const expenses = baseExpenses + extraOut;
    const surplus = income - expenses;
    const gain = assets * (p.irr / 100);
    const cost = liab * (p.ecr / 100);
    assets = assets + gain + Math.max(0, surplus);
    liab = Math.max(0, liab + cost - Math.max(0, surplus * (p.surplusToLiab / 100)));
    nw = assets - liab;
    const display = p.outputMode === "InflAdj" ? nw / Math.pow(1 + p.inflation/100, yearsFromStart) : nw;
    out.push({ year: y, nw: display, income, expenses, surplus, assets, liab });
  }
  return out;
}

export function irrApprox(start: number, end: number, contributions: number, periods: number): number {
  if (start <= 0 || periods <= 0) return 0;
  const denom = start + contributions / 2;
  if (denom <= 0) return 0;
  const r = (end - start - contributions) / denom;
  return Math.pow(1 + r, 1 / Math.max(1, periods / 12)) - 1;
}
