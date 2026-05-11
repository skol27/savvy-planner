import * as React from "react";
import type { Settings, AssetCategory, LiabilityCategory, BudgetCategory, BudgetPosition, NWPosition, Transaction, Goal, ExtraCashFlow, Projection, BudgetSection } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultSettings: Settings = {
  startingYear: 2026, startingMonth: 2, shiftLateIncome: false, lateIncomeDay: 6,
  latestTrackedMode: "Lazy", irrEcr: true,
};

const incomeCats = ["Work Income","Parents","Gifts","Capital Income","Other"];
const expenseCats = ["Housing","Food & Drink","Transportation","Entertainment","Insurance","Self-Care","Shopping","Subscriptions","Education","Vacation","Other"];
const savingsCats = ["Emergency","Retirement","Investment","IBKR Account"];
const debtCats = ["Credit Card Debt","Student Loan Debt","Mortgage","Car Debt","Personal Debt"];

const buildBudgetCats = (): BudgetCategory[] => [
  ...incomeCats.map(n => ({ id: uid(), section: "Income" as BudgetSection, name: n })),
  ...expenseCats.map(n => ({ id: uid(), section: "Expenses" as BudgetSection, name: n })),
  ...savingsCats.map(n => ({ id: uid(), section: "Savings" as BudgetSection, name: n })),
  ...debtCats.map(n => ({ id: uid(), section: "Debt" as BudgetSection, name: n })),
];

const defaultAssetCats: AssetCategory[] = [
  { id: uid(), name: "Cash Available", horizon: "ST", cash: true, available: true },
  { id: uid(), name: "Cash Savings", horizon: "ST", cash: true, available: true },
  { id: uid(), name: "ETFs", horizon: "LT", cash: true, available: true },
  { id: uid(), name: "Stocks", horizon: "LT", cash: true, available: true },
  { id: uid(), name: "Cash on Hand", horizon: "ST", cash: false, available: false },
  { id: uid(), name: "Real Estate", horizon: "LT", cash: false, available: false },
  { id: uid(), name: "IBKR Free Cash", horizon: "LT", cash: true, available: true },
];
const defaultLiabCats: LiabilityCategory[] = [
  { id: uid(), name: "Credit Card Debt", horizon: "ST" },
  { id: uid(), name: "Mortgages", horizon: "LT" },
  { id: uid(), name: "Car Loans", horizon: "LT" },
  { id: uid(), name: "Student Loans", horizon: "LT" },
  { id: uid(), name: "Personal Loans", horizon: "LT" },
];

function buildBudgetPositions(cats: BudgetCategory[]): BudgetPosition[] {
  const findCat = (section: BudgetSection, name: string) => cats.find(c => c.section === section && c.name === name)!;
  const def = (section: BudgetSection, catName: string, name: string, monthly: number) =>
    ({ id: uid(), section, categoryId: findCat(section, catName).id, name, monthly: Array(12).fill(monthly) });
  return [
    def("Income","Work Income","Gerolds Garten",2200),
    def("Income","Parents","Mom",200),
    def("Income","Parents","Dad",150),
    def("Income","Gifts","Gifts",50),
    def("Income","Other","Other",0),
    def("Income","Capital Income","Capital Income",30),
    def("Expenses","Housing","Rent",950),
    def("Expenses","Insurance","Healthcare",180),
    def("Expenses","Insurance","Car",60),
    def("Expenses","Subscriptions","Mobile Data",25),
    def("Expenses","Subscriptions","Splice",12),
    def("Expenses","Subscriptions","RealDebird (Streaming)",8),
    def("Expenses","Subscriptions","ChatGPT",22),
    def("Expenses","Food & Drink","Food & Drink",380),
    def("Expenses","Transportation","Fuel",120),
    def("Expenses","Transportation","Other Transport",40),
    def("Expenses","Entertainment","Going-Out",90),
    def("Expenses","Entertainment","Activities",60),
    def("Expenses","Vacation","Vacation",150),
    def("Expenses","Education","Studium",80),
    def("Expenses","Shopping","Gifts",40),
    def("Expenses","Shopping","Clothes",70),
    def("Expenses","Shopping","Misc",60),
    def("Savings","Emergency","Savings Account",200),
    def("Savings","Retirement","VWCE",250),
    def("Savings","Investment","AMD",80),
    def("Savings","Investment","SANDISK",40),
    def("Savings","Investment","SAMSUNG",40),
    def("Savings","IBKR Account","IBKR Cash",60),
    def("Debt","Credit Card Debt","Credit Card Debt",0),
    def("Debt","Student Loan Debt","Student Loan Debt",80),
    def("Debt","Mortgage","Mortgage",0),
    def("Debt","Car Debt","Car Debt",0),
    def("Debt","Personal Debt","Personal Debt",0),
  ];
}

function monthsRange(startY: number, startM: number, count: number): string[] {
  const out: string[] = [];
  let y = startY, m = startM;
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2,"0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

function buildNWPositions(assetCats: AssetCategory[], liabCats: LiabilityCategory[]): NWPosition[] {
  const months = monthsRange(2026, 2, 10); // 10 months of tracked data
  const seed = (start: number, growth: number) => {
    const out: Record<string, number> = {};
    months.forEach((mk, i) => { out[mk] = Math.round(start + growth * i + (Math.random() - 0.5) * growth * 0.2); });
    return out;
  };
  const find = (arr: {id:string;name:string}[], n: string) => arr.find(c => c.name === n)!.id;
  return [
    { id: uid(), type: "Asset", categoryId: find(assetCats,"Cash Available"), name: "Neon Konto", balances: seed(3200, 80) },
    { id: uid(), type: "Asset", categoryId: find(assetCats,"Cash Savings"), name: "Spar Konto", balances: seed(8500, 200) },
    { id: uid(), type: "Asset", categoryId: find(assetCats,"IBKR Free Cash"), name: "IBKR Free Cash", balances: seed(1100, 60) },
    { id: uid(), type: "Asset", categoryId: find(assetCats,"ETFs"), name: "VWCE", balances: seed(12400, 320) },
    { id: uid(), type: "Asset", categoryId: find(assetCats,"Stocks"), name: "AMD", balances: seed(2200, 90) },
    { id: uid(), type: "Liability", categoryId: find(liabCats,"Student Loans"), name: "Student Loan", balances: seed(8200, -80) },
    { id: uid(), type: "Liability", categoryId: find(liabCats,"Credit Card Debt"), name: "Visa", balances: seed(420, -10) },
  ];
}

function buildTxs(positions: BudgetPosition[], nw: NWPosition[]): Transaction[] {
  const accounts = nw.map(n => n.name);
  const findPos = (name: string) => positions.find(p => p.name === name);
  const months = monthsRange(2026, 2, 10);
  const txs: Transaction[] = [];
  months.forEach((mk, idx) => {
    const [y, m] = mk.split("-");
    const dt = (d: number) => `${y}-${m}-${String(d).padStart(2,"0")}`;
    const add = (date: string, amount: number, details: string, account: string, type: any, posName?: string) =>
      txs.push({ id: uid(), date, amount, details, account, budgetType: type, budgetPositionId: posName ? findPos(posName)?.id : undefined });
    add(dt(1), 2200, "Salary Gerolds Garten", "Neon Konto", "Income", "Gerolds Garten");
    add(dt(3), -950, "Rent", "Neon Konto", "Expenses", "Rent");
    add(dt(5), -180, "Healthcare", "Neon Konto", "Expenses", "Healthcare");
    add(dt(7), -42, "Groceries Migros", "Neon Konto", "Expenses", "Food & Drink");
    add(dt(9), -25, "Mobile Data", "Neon Konto", "Expenses", "Mobile Data");
    add(dt(12), -90 - idx*3, "Restaurant night", "Neon Konto", "Expenses", "Going-Out");
    add(dt(15), -200, "Transfer to savings", "Neon Konto", "Transfer");
    add(dt(15), 200, "Transfer from checking", "Spar Konto", "Transfer");
    add(dt(18), -250, "VWCE buy", "Neon Konto", "Savings", "VWCE");
    add(dt(20), -38, "Fuel", "Neon Konto", "Expenses", "Fuel");
    if (idx % 2 === 0) add(dt(22), -150, "Vacation booking", "Neon Konto", "Expenses", "Vacation");
    add(dt(25), 200, "Mom transfer", "Neon Konto", "Income", "Mom");
    add(dt(28), -80, "Student loan repayment", "Neon Konto", "Debt", "Student Loan Debt");
  });
  return txs;
}

const defaultGoals: Goal[] = [
  { id: uid(), name: "First 100k", amount: 100000, show: true, type: "NW" },
  { id: uid(), name: "First 250k", amount: 250000, show: true, type: "NW" },
  { id: uid(), name: "First 1M", amount: 1000000, show: true, type: "NW" },
  { id: uid(), name: "FIRE", amount: 1050000, show: true, type: "FIRE" },
];

const defaultExtras: ExtraCashFlow[] = [
  { id: uid(), label: "Inheritance", type: "Income", amount: 50000, startYear: 2050, lastYear: 2050, growth: 0, include: true },
  { id: uid(), label: "House purchase", type: "Expenses", amount: 80000, startYear: 2035, lastYear: 2035, growth: 0, include: true },
];

const defaultProjection: Projection = {
  endYear: 2090, outputMode: "InflAdj", extraCFMode: "PV", retirementMode: "PV",
  initialIncome: 26000, initialExpenses: 24000, incomeGrowth: 4, inflation: 2,
  desiredExpenses: 42000, surplusToLiab: 0, irr: 5, ecr: 0, minPrincipal: 0,
  birthday: "1998-05-12", retirementYear: 2066, retirementIncome: 36000, retirementGrowth: 2,
  taxOnLiquidation: false, taxableFraction: 0, taxRate: 15, taxFreeAllowance: 0,
};

interface Store {
  settings: Settings; setSettings: (s: Settings) => void;
  budgetCats: BudgetCategory[]; setBudgetCats: React.Dispatch<React.SetStateAction<BudgetCategory[]>>;
  assetCats: AssetCategory[]; setAssetCats: React.Dispatch<React.SetStateAction<AssetCategory[]>>;
  liabCats: LiabilityCategory[]; setLiabCats: React.Dispatch<React.SetStateAction<LiabilityCategory[]>>;
  positions: BudgetPosition[]; setPositions: React.Dispatch<React.SetStateAction<BudgetPosition[]>>;
  nwPositions: NWPosition[]; setNwPositions: React.Dispatch<React.SetStateAction<NWPosition[]>>;
  transactions: Transaction[]; setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  goals: Goal[]; setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  extras: ExtraCashFlow[]; setExtras: React.Dispatch<React.SetStateAction<ExtraCashFlow[]>>;
  projection: Projection; setProjection: (p: Projection) => void;
  trackedMonths: string[];
}

const Ctx = React.createContext<Store | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<Settings>(defaultSettings);
  const [budgetCats, setBudgetCats] = React.useState<BudgetCategory[]>(() => buildBudgetCats());
  const [assetCats, setAssetCats] = React.useState<AssetCategory[]>(defaultAssetCats);
  const [liabCats, setLiabCats] = React.useState<LiabilityCategory[]>(defaultLiabCats);
  const [positions, setPositions] = React.useState<BudgetPosition[]>(() => buildBudgetPositions(budgetCats));
  const [nwPositions, setNwPositions] = React.useState<NWPosition[]>(() => buildNWPositions(assetCats, liabCats));
  const [transactions, setTransactions] = React.useState<Transaction[]>(() => buildTxs(positions, nwPositions));
  const [goals, setGoals] = React.useState<Goal[]>(defaultGoals);
  const [extras, setExtras] = React.useState<ExtraCashFlow[]>(defaultExtras);
  const [projection, setProjection] = React.useState<Projection>(defaultProjection);

  const trackedMonths = React.useMemo(() => {
    const set = new Set<string>();
    nwPositions.forEach(p => Object.keys(p.balances).forEach(m => set.add(m)));
    return [...set].sort();
  }, [nwPositions]);

  return (
    <Ctx.Provider value={{ settings, setSettings, budgetCats, setBudgetCats, assetCats, setAssetCats, liabCats, setLiabCats, positions, setPositions, nwPositions, setNwPositions, transactions, setTransactions, goals, setGoals, extras, setExtras, projection, setProjection, trackedMonths }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFinance() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useFinance must be inside FinanceProvider");
  return v;
}

export { uid, monthsRange };
