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

export const STORAGE_KEY = "savvy-planner-finance-state-v1";
export const BACKUP_APP_ID = "savvy-planner";
export const BACKUP_SCHEMA_VERSION = 1;

export interface FinanceState {
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

export interface FinanceBackup {
  app: typeof BACKUP_APP_ID;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  reason?: string;
  state: FinanceState;
}

export type PersistenceStatus =
  | "loading"
  | "file"
  | "browser"
  | "workbook"
  | "saving"
  | "file-unavailable"
  | "error";

export function createBackup(
  state: FinanceState,
  exportedAt = new Date().toISOString(),
  reason?: string,
): FinanceBackup {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    reason,
    state,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFinanceState(value: unknown): value is FinanceState {
  if (!isObject(value)) return false;
  return (
    isObject(value.settings) &&
    Array.isArray(value.budgetCats) &&
    Array.isArray(value.assetCats) &&
    Array.isArray(value.liabCats) &&
    Array.isArray(value.positions) &&
    Array.isArray(value.nwPositions) &&
    Array.isArray(value.transactions) &&
    Array.isArray(value.goals) &&
    Array.isArray(value.extras) &&
    isObject(value.projection)
  );
}

export function parseFinanceState(value: unknown): FinanceState | null {
  return isFinanceState(value) ? value : null;
}

export function parseBackup(value: unknown): FinanceBackup | null {
  if (!isObject(value)) return null;
  if (value.app !== BACKUP_APP_ID || value.schemaVersion !== BACKUP_SCHEMA_VERSION) return null;
  if (typeof value.exportedAt !== "string") return null;
  const state = parseFinanceState(value.state);
  if (!state) return null;
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: value.exportedAt,
    reason: typeof value.reason === "string" ? value.reason : undefined,
    state,
  };
}

export function backupFileName(date = new Date(), reason?: string): string {
  const stamp = date.toISOString().replace(/[:.]/g, "-");
  const suffix = reason ? `-${reason.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
  return `savvy-planner-backup-${stamp}${suffix}.json`;
}
