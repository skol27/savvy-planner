import { createFileRoute } from "@tanstack/react-router";
import { useFinance, uid } from "@/lib/finance/store";
import { PageHeader } from "@/components/finance/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Upload,
  Trash2,
  AlertCircle,
  Search,
  Pencil,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  CircleDot,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, effectiveDate } from "@/lib/finance/calc";
import type { BudgetPosition, BudgetType, Transaction } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transactions")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: typeof search.type === "string" ? search.type : undefined,
    categoryId: typeof search.categoryId === "string" ? search.categoryId : undefined,
    positionId: typeof search.positionId === "string" ? search.positionId : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Transactions — Ledger" },
      {
        name: "description",
        content:
          "Track every money flow with validation, late-income shifting, and account inference.",
      },
    ],
  }),
  component: TxPage,
});

const types: BudgetType[] = ["Income", "Expenses", "Savings", "Debt", "Transfer", "Blank"];
const typeColor: Record<string, string> = {
  Income: "text-pos",
  Expenses: "text-neg",
  Savings: "text-info",
  Debt: "text-warning",
  Transfer: "text-muted-foreground",
  Blank: "text-muted-foreground",
};
const typeIcon: Record<string, React.ReactNode> = {
  Income: <ArrowDownLeft className="h-3.5 w-3.5" />,
  Expenses: <ArrowUpRight className="h-3.5 w-3.5" />,
  Savings: <CircleDot className="h-3.5 w-3.5" />,
  Debt: <CircleDot className="h-3.5 w-3.5" />,
  Transfer: <ArrowLeftRight className="h-3.5 w-3.5" />,
  Blank: <CircleDot className="h-3.5 w-3.5" />,
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const formatDateDisplay = (iso: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
};
const parseDateDisplay = (value: string) => {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = +match[1];
  const month = +match[2];
  const year = +match[3];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
};
const parseAmount = (value: string) => {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
};
const normalizeAmount = (amount: number, type: BudgetType) => {
  const rounded = Math.round(Math.abs(amount));
  if (type === "Expenses") return -rounded;
  return amount < 0 ? -rounded : rounded;
};
const amountInputValue = (amount: number, type: BudgetType) => {
  if (amount === 0) return "";
  return type === "Expenses" ? String(Math.abs(amount)) : String(amount);
};

const normalizeImportText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
const transactionFingerprint = (t: Pick<Transaction, "date" | "amount" | "details">) =>
  `${t.date}|${t.amount.toFixed(2)}|${normalizeImportText(t.details)}`;

interface ImportedTransaction {
  id: string;
  tx: Transaction;
  source: string;
  sourceCategory?: string;
  duplicate: boolean;
  duplicateReason?: string;
}

const detectDelimiter = (line: string) => {
  const comma = (line.match(/,/g) || []).length;
  const semicolon = (line.match(/;/g) || []).length;
  return semicolon > comma ? ";" : ",";
};
const parseCsv = (text: string) => {
  const delimiter = detectDelimiter(text.split(/\r?\n/)[0] || ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  const headers = rows[0]?.map((h) => h.trim()) || [];
  return rows.slice(1).map((values) =>
    headers.reduce<Record<string, string>>((out, header, index) => {
      out[header] = (values[index] || "").trim();
      return out;
    }, {}),
  );
};
const field = (row: Record<string, string>, names: string[]) => {
  const entries = Object.entries(row);
  for (const name of names) {
    const found = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (found) return found[1];
  }
  return "";
};
const parseImportDate = (value: string) => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dot = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(trimmed);
  if (dot) return parseDateDisplay(`${dot[1]}.${dot[2]}.${dot[3]}`);
  return null;
};
const parseImportAmount = (value: string) => {
  const cleaned = value
    .replace(/[^\d.,'’+\-\s]/g, "")
    .replace(/['’\s]/g, "")
    .replace(",", ".");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
};
const normalizeImportedAmount = (amount: number, type: BudgetType) => {
  const rounded = Math.round(Math.abs(amount));
  return type === "Expenses" ? -rounded : rounded;
};
const guessBudgetPosition = (
  positions: BudgetPosition[],
  type: BudgetType,
  sourceCategory: string,
  merchant: string,
) => {
  if (type !== "Income" && type !== "Expenses") return undefined;
  const haystack = `${sourceCategory} ${merchant}`.toLowerCase();
  const candidates = positions.filter((p) => p.section === type);
  const aliases =
    type === "Income"
      ? ["work income", "income", "gerolds", "parents"]
      : haystack.includes("food") || haystack.includes("grocer") || haystack.includes("restaurant")
        ? ["food"]
        : haystack.includes("transport") || haystack.includes("auto") || haystack.includes("voi")
          ? ["transport", "fuel"]
          : haystack.includes("shopping") || haystack.includes("clothing")
            ? ["shopping", "clothes", "misc"]
            : haystack.includes("entertainment")
              ? ["entertainment", "activities"]
              : [];
  return (
    candidates.find((p) => aliases.some((alias) => p.name.toLowerCase().includes(alias)))?.id ||
    undefined
  );
};

function TxPage() {
  const search = Route.useSearch();
  const {
    transactions,
    setTransactions,
    positions,
    budgetCats,
    nwPositions,
    settings,
    createBackupSnapshot,
  } = useFinance();
  const [q, setQ] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPosition, setFilterPosition] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importQueue, setImportQueue] = useState<ImportedTransaction[]>([]);
  const [importIndex, setImportIndex] = useState(0);
  const [importDuplicateCount, setImportDuplicateCount] = useState(0);
  const [importError, setImportError] = useState("");
  const importBackupCreated = useRef(false);
  const accounts = nwPositions.map((n) => n.name);
  const categoryFilterOptions = budgetCats.filter(
    (c) => filterType === "all" || c.section === filterType,
  );
  const positionFilterOptions = positions.filter(
    (p) =>
      (filterType === "all" || p.section === filterType) &&
      (filterCategory === "all" || p.categoryId === filterCategory),
  );
  const currentImport = importQueue[importIndex];

  useEffect(() => {
    if (search.type && types.includes(search.type as BudgetType)) setFilterType(search.type);
    if (search.categoryId) setFilterCategory(search.categoryId);
    if (search.positionId) setFilterPosition(search.positionId);
    if (search.from) setFrom(search.from);
    if (search.to) setTo(search.to);
  }, [search.type, search.categoryId, search.positionId, search.from, search.to]);

  const filtered = useMemo(() => {
    let r = [...transactions];
    if (q) r = r.filter((t) => t.details.toLowerCase().includes(q.toLowerCase()));
    if (filterAccount !== "all") r = r.filter((t) => t.account === filterAccount);
    if (filterType !== "all") r = r.filter((t) => t.budgetType === filterType);
    if (filterCategory !== "all") {
      const categoryPositionIds = new Set(
        positions.filter((p) => p.categoryId === filterCategory).map((p) => p.id),
      );
      r = r.filter((t) => t.budgetPositionId && categoryPositionIds.has(t.budgetPositionId));
    }
    if (filterPosition !== "all") r = r.filter((t) => t.budgetPositionId === filterPosition);
    if (from) r = r.filter((t) => t.date >= from);
    if (to) r = r.filter((t) => t.date <= to);
    r.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return r;
  }, [
    transactions,
    q,
    filterAccount,
    filterType,
    filterCategory,
    filterPosition,
    from,
    to,
    positions,
  ]);

  const totalsByType = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((t) => {
      m[t.budgetType] = (m[t.budgetType] || 0) + Math.abs(t.amount);
    });
    return m;
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    filtered.forEach((t) => {
      const key = t.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const validate = (t: Transaction) => {
    const errs: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) errs.push("Bad date");
    if (typeof t.amount !== "number" || isNaN(t.amount)) errs.push("Bad amount");
    if (!accounts.includes(t.account)) errs.push("Unknown account");
    if (t.budgetType !== "Transfer" && t.budgetType !== "Blank" && t.budgetPositionId) {
      const pos = positions.find((p) => p.id === t.budgetPositionId);
      if (!pos || pos.section !== t.budgetType) errs.push("Position mismatch");
    }
    return errs;
  };

  const openAdd = (preset?: Partial<Transaction>) => {
    const next = {
      id: "",
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      details: "",
      account: accounts[0] || "",
      budgetType: "Expenses",
      ...preset,
    } as Transaction;
    setEditing(next);
    setDateInput(formatDateDisplay(next.date));
    setAmountInput(amountInputValue(next.amount, next.budgetType));
    setDialogOpen(true);
  };
  const openEdit = (t: Transaction) => {
    setEditing({ ...t });
    setDateInput(formatDateDisplay(t.date));
    setAmountInput(amountInputValue(t.amount, t.budgetType));
    setDialogOpen(true);
  };

  const normalizedEditing = () => {
    if (!editing) return;
    const parsedDate = parseDateDisplay(dateInput);
    const parsedAmount = parseAmount(amountInput);
    if (!parsedDate || parsedAmount === null) return;
    return {
      ...editing,
      date: parsedDate,
      amount: normalizeAmount(parsedAmount, editing.budgetType),
    };
  };

  const save = (keepAdding = false) => {
    const tx = normalizedEditing();
    if (!tx) return;
    if (tx.id) {
      setTransactions((prev) => prev.map((x) => (x.id === tx.id ? tx : x)));
    } else {
      setTransactions((prev) => [{ ...tx, id: uid() }, ...prev]);
      if (keepAdding) {
        const next = {
          id: "",
          date: tx.date,
          amount: 0,
          details: "",
          account: tx.account,
          budgetType: "Expenses",
          budgetPositionId: undefined,
        } as Transaction;
        setEditing(next);
        setDateInput(formatDateDisplay(next.date));
        setAmountInput("");
        return;
      }
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const duplicateInfo = (tx: Transaction, seen: Set<string>) => {
    const fp = transactionFingerprint(tx);
    if (seen.has(fp)) return "Already in this CSV";
    const match = transactions.find((existing) => transactionFingerprint(existing) === fp);
    if (match) return `Already exists: ${match.details}`;
    return undefined;
  };

  const parseImportedTransactions = (text: string, fileName: string) => {
    const rows = parseCsv(text);
    const seen = new Set<string>();
    const parsed = rows
      .map((row, index): ImportedTransaction | null => {
        const rawDate = field(row, ["Transaction date", "Date", "Booking date", "Value date"]);
        const date = parseImportDate(rawDate);
        const rawAmount = field(row, ["Amount", "Amount in CHF", "Booked amount"]);
        const parsedAmount = parseImportAmount(rawAmount);
        const debitCredit = field(row, ["Debit/Credit", "Type"]).toLowerCase();
        const merchant =
          field(row, ["Merchant", "Description", "Name", "Payee"]) ||
          field(row, ["Description", "Subject"]);
        const description = field(row, ["Description", "Subject"]);
        const sourceCategory = field(row, ["Category", "Merchant Category", "Registered Category"]);
        if (!date || parsedAmount === null || !merchant) return null;
        const isSwisscardFormat = Boolean(row["Transaction date"] && row["Debit/Credit"]);
        const isCredit = isSwisscardFormat
          ? debitCredit.includes("credit")
          : debitCredit.includes("credit") || sourceCategory.toLowerCase() === "income";
        const budgetType: BudgetType = isCredit ? "Income" : "Expenses";
        const tx: Transaction = {
          id: "",
          date,
          amount: normalizeImportedAmount(parsedAmount, budgetType),
          details: merchant || description || "Imported transaction",
          account: accounts[0] || "",
          budgetType,
          budgetPositionId: guessBudgetPosition(positions, budgetType, sourceCategory, merchant),
        };
        const duplicateReason = duplicateInfo(tx, seen);
        seen.add(transactionFingerprint(tx));
        return {
          id: `${fileName}-${index}`,
          tx,
          source: fileName,
          sourceCategory,
          duplicate: !!duplicateReason,
          duplicateReason,
        };
      })
      .filter((item): item is ImportedTransaction => item !== null);
    return parsed;
  };

  const handleCsvUpload = async (file: File) => {
    setImportError("");
    const text = await file.text();
    const parsed = parseImportedTransactions(text, file.name);
    const newRows = parsed.filter((item) => !item.duplicate);
    setImportDuplicateCount(parsed.length - newRows.length);
    setImportQueue(newRows);
    setImportIndex(0);
    importBackupCreated.current = false;
    setImportOpen(true);
    if (newRows.length === 0) {
      setImportError(
        parsed.length === 0
          ? "No usable transactions found in this CSV."
          : "No new transactions found. All detected rows are duplicates.",
      );
    }
  };

  const updateImportTx = (patch: Partial<Transaction>) => {
    setImportQueue((prev) =>
      prev.map((item, index) =>
        index === importIndex ? { ...item, tx: { ...item.tx, ...patch } } : item,
      ),
    );
  };

  const finishCurrentImport = async (add: boolean) => {
    if (!currentImport) return;
    if (add) {
      if (!importBackupCreated.current) {
        const backedUp = await createBackupSnapshot("before-csv-import");
        if (!backedUp) {
          window.alert("Import stopped. Automatic backup could not be written.");
          return;
        }
        importBackupCreated.current = true;
      }
      setTransactions((prev) => [{ ...currentImport.tx, id: uid() }, ...prev]);
    }
    if (importIndex + 1 >= importQueue.length) {
      setImportOpen(false);
      setImportQueue([]);
      setImportIndex(0);
      importBackupCreated.current = false;
      return;
    }
    setImportIndex((i) => i + 1);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Transactions"
        description={`${filtered.length} of ${transactions.length} transactions`}
        actions={
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleCsvUpload(file);
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Upload CSV
            </Button>
            <Button size="sm" onClick={() => openAdd()}>
              <Plus className="h-3.5 w-3.5" />
              Add Transaction
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-4">
        {/* Summary by type */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(filterType === t ? "all" : t)}
              className={cn(
                "rounded-md border bg-card px-3 py-2 text-left transition hover:border-primary/50",
                filterType === t && "border-primary bg-accent",
              )}
            >
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={typeColor[t]}>{typeIcon[t]}</span>
                {t}
              </div>
              <div className={cn("num font-semibold text-sm mt-0.5", typeColor[t])}>
                {fmt(totalsByType[t] || 0)}
              </div>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-lg border bg-card p-3">
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search details..."
                className="pl-7 h-8"
              />
            </div>
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterType}
              onValueChange={(value) => {
                setFilterType(value);
                setFilterCategory("all");
                setFilterPosition("all");
              }}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {types.map((ty) => (
                  <SelectItem key={ty} value={ty}>
                    {ty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterCategory}
              onValueChange={(value) => {
                setFilterCategory(value);
                setFilterPosition("all");
              }}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categoryFilterOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPosition} onValueChange={setFilterPosition}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All positions</SelectItem>
                {positionFilterOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8"
              placeholder="From"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8"
              placeholder="To"
            />
          </div>
        </div>

        {/* Grouped list */}
        {grouped.length === 0 && (
          <div className="rounded-lg border bg-card py-16 text-center text-sm text-muted-foreground">
            No transactions match the current filters.
          </div>
        )}
        {grouped.map(([month, items]) => {
          const monthTotal = items.reduce((a, t) => a + t.amount, 0);
          return (
            <div key={month} className="rounded-lg border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold num">{month}</h3>
                  <span className="text-xs text-muted-foreground">{items.length} entries</span>
                </div>
                <div
                  className={cn(
                    "num text-sm font-semibold",
                    monthTotal >= 0 ? "text-pos" : "text-neg",
                  )}
                >
                  {fmt(monthTotal)}
                </div>
              </div>
              <ul className="divide-y">
                {items.map((t) => {
                  const errs = validate(t);
                  const eff = effectiveDate(t.date, settings, t.budgetType);
                  const shifted = eff !== t.date;
                  const pos = positions.find((p) => p.id === t.budgetPositionId);
                  return (
                    <li
                      key={t.id}
                      className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full bg-muted",
                          typeColor[t.budgetType],
                        )}
                      >
                        {typeIcon[t.budgetType]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {t.details || (
                              <span className="italic text-muted-foreground">No description</span>
                            )}
                          </span>
                          {errs.length > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-destructive text-destructive gap-1"
                            >
                              <AlertCircle className="h-3 w-3" />
                              {errs[0]}
                            </Badge>
                          )}
                          {shifted && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-warning text-warning"
                            >
                              shifted → {formatDateDisplay(eff)}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="num">{formatDateDisplay(t.date)}</span>
                          <span>·</span>
                          <span>{t.account}</span>
                          <span>·</span>
                          <span className={typeColor[t.budgetType]}>{t.budgetType}</span>
                          {pos && (
                            <>
                              <span>·</span>
                              <span>{pos.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "num text-sm font-semibold tabular-nums",
                          t.amount > 0 ? "text-pos" : t.amount < 0 ? "text-neg" : "",
                        )}
                      >
                        {fmt(t.amount)}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() =>
                            setTransactions((prev) => prev.filter((x) => x.id !== t.id))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="h-9 num"
                    placeholder="dd.mm.yyyy"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const parsed = parseAmount(raw);
                      setAmountInput(raw);
                      if (parsed !== null) {
                        setEditing({
                          ...editing,
                          amount: normalizeAmount(parsed, editing.budgetType),
                        });
                      }
                    }}
                    onBlur={() => {
                      const parsed = parseAmount(amountInput);
                      if (parsed === null) return;
                      const amount = normalizeAmount(parsed, editing.budgetType);
                      setEditing({ ...editing, amount });
                      setAmountInput(amountInputValue(amount, editing.budgetType));
                    }}
                    className={cn(
                      "h-9 num text-right",
                      editing.amount > 0 ? "text-pos" : editing.amount < 0 ? "text-neg" : "",
                    )}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Details</Label>
                <Input
                  value={editing.details}
                  onChange={(e) => setEditing({ ...editing, details: e.target.value })}
                  className="h-9"
                  placeholder="What was this for?"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Account</Label>
                  <Select
                    value={editing.account}
                    onValueChange={(v) => setEditing({ ...editing, account: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={editing.budgetType}
                    onValueChange={(v) => {
                      const budgetType = v as BudgetType;
                      const parsed = parseAmount(amountInput);
                      const amount =
                        parsed === null ? editing.amount : normalizeAmount(parsed, budgetType);
                      setEditing({ ...editing, budgetType, amount, budgetPositionId: undefined });
                      setAmountInput(amountInputValue(amount, budgetType));
                    }}
                  >
                    <SelectTrigger className={cn("h-9", typeColor[editing.budgetType])}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((ty) => (
                        <SelectItem key={ty} value={ty}>
                          {ty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(() => {
                const candidates = positions.filter((p) => p.section === editing.budgetType);
                if (candidates.length === 0) return null;
                return (
                  <div className="space-y-1">
                    <Label className="text-xs">Budget Position</Label>
                    <Select
                      value={editing.budgetPositionId || "none"}
                      onValueChange={(v) =>
                        setEditing({ ...editing, budgetPositionId: v === "none" ? undefined : v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {candidates.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            {!editing?.id && (
              <Button variant="outline" onClick={() => save(true)}>
                Add & New
              </Button>
            )}
            <Button onClick={() => save()}>
              {editing?.id ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Review CSV Import</DialogTitle>
          </DialogHeader>
          {importError ? (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
              {importError}
            </div>
          ) : currentImport ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Entry {importIndex + 1} of {importQueue.length}
                </span>
                <span>
                  {importDuplicateCount} duplicate{importDuplicateCount === 1 ? "" : "s"} skipped
                </span>
              </div>
              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                <div>Source: {currentImport.source}</div>
                {currentImport.sourceCategory && (
                  <div>Detected category: {currentImport.sourceCategory}</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    value={formatDateDisplay(currentImport.tx.date)}
                    onChange={(e) => {
                      const parsed = parseDateDisplay(e.target.value);
                      if (parsed) updateImportTx({ date: parsed });
                    }}
                    className="h-9 num"
                    placeholder="dd.mm.yyyy"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input
                    inputMode="decimal"
                    value={amountInputValue(currentImport.tx.amount, currentImport.tx.budgetType)}
                    onChange={(e) => {
                      const parsed = parseAmount(e.target.value);
                      if (parsed !== null) {
                        updateImportTx({
                          amount: normalizeImportedAmount(parsed, currentImport.tx.budgetType),
                        });
                      }
                    }}
                    className={cn(
                      "h-9 num text-right",
                      currentImport.tx.amount > 0 ? "text-pos" : "text-neg",
                    )}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Merchant / Details</Label>
                <Input
                  value={currentImport.tx.details}
                  onChange={(e) => updateImportTx({ details: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Account</Label>
                  <Select
                    value={currentImport.tx.account}
                    onValueChange={(v) => updateImportTx({ account: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={currentImport.tx.budgetType}
                    onValueChange={(v) => {
                      const budgetType = v as BudgetType;
                      updateImportTx({
                        budgetType,
                        amount: normalizeImportedAmount(currentImport.tx.amount, budgetType),
                        budgetPositionId: undefined,
                      });
                    }}
                  >
                    <SelectTrigger className={cn("h-9", typeColor[currentImport.tx.budgetType])}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((ty) => (
                        <SelectItem key={ty} value={ty}>
                          {ty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(() => {
                const candidates = positions.filter(
                  (p) => p.section === currentImport.tx.budgetType,
                );
                if (candidates.length === 0) return null;
                return (
                  <div className="space-y-1">
                    <Label className="text-xs">Budget Position</Label>
                    <Select
                      value={currentImport.tx.budgetPositionId || "none"}
                      onValueChange={(v) =>
                        updateImportTx({ budgetPositionId: v === "none" ? undefined : v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {candidates.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No transactions to review.</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Close
            </Button>
            {currentImport && !importError && (
              <>
                <Button variant="outline" onClick={() => void finishCurrentImport(false)}>
                  Skip
                </Button>
                <Button onClick={() => void finishCurrentImport(true)}>Add & Next</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
