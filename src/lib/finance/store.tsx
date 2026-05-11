import * as React from "react";
import type {
  AssetCategory,
  BudgetCategory,
  BudgetPosition,
  ExtraCashFlow,
  Goal,
  LiabilityCategory,
  NWPosition,
  Projection,
  Settings,
  Transaction,
} from "./types";
import {
  workbookAssetCategories,
  workbookBudgetCategories,
  workbookBudgetPositions,
  workbookExtraCashFlows,
  workbookGoals,
  workbookLiabilityCategories,
  workbookNetWorthPositions,
  workbookProjection,
  workbookSettings,
  workbookTransactions,
} from "./workbookData";

const STORAGE_KEY = "savvy-planner-finance-state-v1";

const uid = () => Math.random().toString(36).slice(2, 10);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function monthsRange(startY: number, startM: number, count: number): string[] {
  const out: string[] = [];
  let y = startY;
  let m = startM;
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

interface PersistedState {
  settings: Settings;
  budgetCats: BudgetCategory[];
  assetCats: AssetCategory[];
  liabCats: LiabilityCategory[];
  positions: BudgetPosition[];
  nwPositions: NWPosition[];
  transactions: Transaction[];
  goals: Goal[];
  extras: ExtraCashFlow[];
  projection: Projection;
}

const workbookState = (): PersistedState => ({
  settings: clone(workbookSettings),
  budgetCats: clone(workbookBudgetCategories),
  assetCats: clone(workbookAssetCategories),
  liabCats: clone(workbookLiabilityCategories),
  positions: clone(workbookBudgetPositions),
  nwPositions: clone(workbookNetWorthPositions),
  transactions: clone(workbookTransactions),
  goals: clone(workbookGoals),
  extras: clone(workbookExtraCashFlows),
  projection: clone(workbookProjection),
});

function loadSavedState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

interface Store extends PersistedState {
  setSettings: (s: Settings) => void;
  setBudgetCats: React.Dispatch<React.SetStateAction<BudgetCategory[]>>;
  setAssetCats: React.Dispatch<React.SetStateAction<AssetCategory[]>>;
  setLiabCats: React.Dispatch<React.SetStateAction<LiabilityCategory[]>>;
  setPositions: React.Dispatch<React.SetStateAction<BudgetPosition[]>>;
  setNwPositions: React.Dispatch<React.SetStateAction<NWPosition[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  setExtras: React.Dispatch<React.SetStateAction<ExtraCashFlow[]>>;
  setProjection: (p: Projection) => void;
  resetToWorkbook: () => void;
  trackedMonths: string[];
}

const Ctx = React.createContext<Store | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const initial = React.useMemo(() => workbookState(), []);
  const [settings, setSettings] = React.useState<Settings>(initial.settings);
  const [budgetCats, setBudgetCats] = React.useState<BudgetCategory[]>(initial.budgetCats);
  const [assetCats, setAssetCats] = React.useState<AssetCategory[]>(initial.assetCats);
  const [liabCats, setLiabCats] = React.useState<LiabilityCategory[]>(initial.liabCats);
  const [positions, setPositions] = React.useState<BudgetPosition[]>(initial.positions);
  const [nwPositions, setNwPositions] = React.useState<NWPosition[]>(initial.nwPositions);
  const [transactions, setTransactions] = React.useState<Transaction[]>(initial.transactions);
  const [goals, setGoals] = React.useState<Goal[]>(initial.goals);
  const [extras, setExtras] = React.useState<ExtraCashFlow[]>(initial.extras);
  const [projection, setProjection] = React.useState<Projection>(initial.projection);
  const loadedSavedState = React.useRef(false);

  React.useEffect(() => {
    const saved = loadSavedState();
    if (!saved) {
      loadedSavedState.current = true;
      return;
    }
    setSettings(saved.settings);
    setBudgetCats(saved.budgetCats);
    setAssetCats(saved.assetCats);
    setLiabCats(saved.liabCats);
    setPositions(saved.positions);
    setNwPositions(saved.nwPositions);
    setTransactions(saved.transactions);
    setGoals(saved.goals);
    setExtras(saved.extras);
    setProjection(saved.projection);
    loadedSavedState.current = true;
  }, []);

  React.useEffect(() => {
    if (!loadedSavedState.current || typeof window === "undefined") return;
    const state: PersistedState = {
      settings,
      budgetCats,
      assetCats,
      liabCats,
      positions,
      nwPositions,
      transactions,
      goals,
      extras,
      projection,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [
    assetCats,
    budgetCats,
    extras,
    goals,
    liabCats,
    nwPositions,
    positions,
    projection,
    settings,
    transactions,
  ]);

  const resetToWorkbook = React.useCallback(() => {
    const next = workbookState();
    setSettings(next.settings);
    setBudgetCats(next.budgetCats);
    setAssetCats(next.assetCats);
    setLiabCats(next.liabCats);
    setPositions(next.positions);
    setNwPositions(next.nwPositions);
    setTransactions(next.transactions);
    setGoals(next.goals);
    setExtras(next.extras);
    setProjection(next.projection);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const trackedMonths = React.useMemo(() => {
    const set = new Set<string>();
    nwPositions.forEach((p) => Object.keys(p.balances).forEach((m) => set.add(m)));
    return [...set].sort();
  }, [nwPositions]);

  return (
    <Ctx.Provider
      value={{
        settings,
        setSettings,
        budgetCats,
        setBudgetCats,
        assetCats,
        setAssetCats,
        liabCats,
        setLiabCats,
        positions,
        setPositions,
        nwPositions,
        setNwPositions,
        transactions,
        setTransactions,
        goals,
        setGoals,
        extras,
        setExtras,
        projection,
        setProjection,
        resetToWorkbook,
        trackedMonths,
      }}
    >
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
