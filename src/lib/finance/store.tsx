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
  createBackup,
  parseBackup,
  parseFinanceState,
  STORAGE_KEY,
  type FinanceBackup,
  type FinanceState,
  type PersistenceStatus,
} from "./persistence";
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

const workbookState = (): FinanceState => ({
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

function loadBrowserState(): FinanceState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseFinanceState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function statesMatch(a: FinanceState, b: FinanceState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function loadFileBackup(): Promise<FinanceBackup | null> {
  const response = await fetch("/api/state", { headers: { accept: "application/json" } });
  if (response.status === 204 || response.status === 404) return null;
  if (!response.ok) throw new Error("Could not load local data file.");
  return parseBackup(await response.json());
}

async function saveFileBackup(backup: FinanceBackup): Promise<void> {
  const response = await fetch("/api/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(backup),
  });
  if (!response.ok) throw new Error("Could not save local data file.");
}

interface Store extends FinanceState {
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
  importState: (state: FinanceState) => void;
  exportBackup: () => FinanceBackup;
  persistenceStatus: PersistenceStatus;
  persistenceMessage: string;
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
  const [persistenceStatus, setPersistenceStatus] = React.useState<PersistenceStatus>("loading");
  const [persistenceMessage, setPersistenceMessage] = React.useState("Loading saved data...");
  const hydrated = React.useRef(false);
  const filePersistenceAvailable = React.useRef(false);
  const skipNextFileSave = React.useRef(false);

  const currentState = React.useMemo<FinanceState>(
    () => ({
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
    }),
    [
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
    ],
  );

  const applyState = React.useCallback((next: FinanceState) => {
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
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const browserState = loadBrowserState();

      try {
        const fileBackup = await loadFileBackup();
        if (cancelled) return;
        if (fileBackup) {
          if (browserState && !statesMatch(fileBackup.state, browserState)) {
            applyState(browserState);
            filePersistenceAvailable.current = true;
            skipNextFileSave.current = false;
            setPersistenceStatus("browser");
            setPersistenceMessage("Migrating browser data into the local data file.");
            hydrated.current = true;
            return;
          }
          applyState(fileBackup.state);
          filePersistenceAvailable.current = true;
          setPersistenceStatus("file");
          setPersistenceMessage("Saved to local data file.");
          hydrated.current = true;
          return;
        }
        filePersistenceAvailable.current = true;
      } catch {
        if (cancelled) return;
        filePersistenceAvailable.current = false;
      }

      if (cancelled) return;
      if (browserState) {
        applyState(browserState);
        skipNextFileSave.current = false;
        setPersistenceStatus(filePersistenceAvailable.current ? "browser" : "file-unavailable");
        setPersistenceMessage(
          filePersistenceAvailable.current
            ? "Using browser data until the local file is created."
            : "Local file storage unavailable. Browser storage is active.",
        );
      } else {
        skipNextFileSave.current = true;
        setPersistenceStatus(filePersistenceAvailable.current ? "workbook" : "file-unavailable");
        setPersistenceMessage(
          filePersistenceAvailable.current
            ? "Using workbook seed data until the first save."
            : "Local file storage unavailable. Workbook seed data is active.",
        );
      }
      hydrated.current = true;
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [applyState]);

  React.useEffect(() => {
    if (!hydrated.current || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));

    if (skipNextFileSave.current) {
      skipNextFileSave.current = false;
      return;
    }

    if (!filePersistenceAvailable.current) {
      setPersistenceStatus("file-unavailable");
      setPersistenceMessage("Local file storage unavailable. Browser storage is active.");
      return;
    }

    setPersistenceStatus("saving");
    setPersistenceMessage("Saving to local data file...");
    const timeout = window.setTimeout(() => {
      void saveFileBackup(createBackup(currentState))
        .then(() => {
          setPersistenceStatus("file");
          setPersistenceMessage("Saved to local data file.");
        })
        .catch(() => {
          setPersistenceStatus("error");
          setPersistenceMessage("File save failed. Browser storage is still active.");
        });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [currentState]);

  const resetToWorkbook = React.useCallback(() => {
    const next = workbookState();
    applyState(next);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [applyState]);

  const importState = React.useCallback(
    (next: FinanceState) => {
      applyState(next);
    },
    [applyState],
  );

  const exportBackup = React.useCallback(() => createBackup(currentState), [currentState]);

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
        importState,
        exportBackup,
        persistenceStatus,
        persistenceMessage,
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
