export type BudgetSection = "Income" | "Expenses" | "Savings" | "Debt";
export type Horizon = "ST" | "LT";
export type BudgetType = BudgetSection | "Transfer" | "Blank";

export interface Settings {
  startingYear: number;
  startingMonth: number;
  shiftLateIncome: boolean;
  lateIncomeDay: number;
  latestTrackedMode: "Lazy" | "Strict";
  irrEcr: boolean;
}
export interface AssetCategory {
  id: string;
  name: string;
  horizon: Horizon;
  cash: boolean;
  available: boolean;
}
export interface LiabilityCategory {
  id: string;
  name: string;
  horizon: Horizon;
}
export interface BudgetCategory {
  id: string;
  section: BudgetSection;
  name: string;
}
export interface BudgetPosition {
  id: string;
  section: BudgetSection;
  categoryId: string;
  name: string;
  monthly: number[]; /* 10 years flattened as Jan-Dec blocks */
}
export interface NWPosition {
  id: string;
  type: "Asset" | "Liability";
  categoryId: string;
  name: string;
  balances: Record<string, number>; /* "YYYY-MM" -> balance */
}
export interface Transaction {
  id: string;
  date: string;
  amount: number;
  details: string;
  account: string;
  budgetType: BudgetType;
  budgetPositionId?: string;
}
export interface Goal {
  id: string;
  name: string;
  amount: number;
  show: boolean;
  targetDate?: string;
  type: "NW" | "FIRE" | "Custom";
}
export interface ExtraCashFlow {
  id: string;
  label: string;
  type: "Income" | "Expenses" | "Savings";
  amount: number;
  startYear: number;
  lastYear: number;
  growth: number;
  include: boolean;
}
export interface Projection {
  endYear: number;
  outputMode: "Nominal" | "InflAdj";
  extraCFMode: "Nominal" | "PV";
  retirementMode: "Nominal" | "PV";
  initialIncome: number;
  initialExpenses: number;
  incomeGrowth: number;
  inflation: number;
  desiredExpenses: number;
  surplusToLiab: number;
  irr: number;
  ecr: number;
  minPrincipal: number;
  birthday: string;
  retirementYear: number;
  retirementIncome: number;
  retirementGrowth: number;
  taxOnLiquidation: boolean;
  taxableFraction: number;
  taxRate: number;
  taxFreeAllowance: number;
}
