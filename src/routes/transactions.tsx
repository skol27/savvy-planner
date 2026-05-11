import { createFileRoute } from "@tanstack/react-router";
import { useFinance, uid } from "@/lib/finance/store";
import { PageHeader } from "@/components/finance/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, AlertCircle, Search, Pencil, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CircleDot } from "lucide-react";
import { useMemo, useState } from "react";
import { fmt, effectiveDate } from "@/lib/finance/calc";
import type { BudgetType, Transaction } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Ledger" }, { name: "description", content: "Track every money flow with validation, late-income shifting, and account inference." }] }),
  component: TxPage,
});

const types: BudgetType[] = ["Income", "Expenses", "Savings", "Debt", "Transfer", "Blank"];
const typeColor: Record<string, string> = {
  Income: "text-pos", Expenses: "text-neg", Savings: "text-info",
  Debt: "text-warning", Transfer: "text-muted-foreground", Blank: "text-muted-foreground",
};
const typeIcon: Record<string, React.ReactNode> = {
  Income: <ArrowDownLeft className="h-3.5 w-3.5" />,
  Expenses: <ArrowUpRight className="h-3.5 w-3.5" />,
  Savings: <CircleDot className="h-3.5 w-3.5" />,
  Debt: <CircleDot className="h-3.5 w-3.5" />,
  Transfer: <ArrowLeftRight className="h-3.5 w-3.5" />,
  Blank: <CircleDot className="h-3.5 w-3.5" />,
};

function TxPage() {
  const { transactions, setTransactions, positions, nwPositions, settings } = useFinance();
  const [q, setQ] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const accounts = nwPositions.map((n) => n.name);

  const filtered = useMemo(() => {
    let r = [...transactions];
    if (q) r = r.filter((t) => t.details.toLowerCase().includes(q.toLowerCase()));
    if (filterAccount !== "all") r = r.filter((t) => t.account === filterAccount);
    if (filterType !== "all") r = r.filter((t) => t.budgetType === filterType);
    if (from) r = r.filter((t) => t.date >= from);
    if (to) r = r.filter((t) => t.date <= to);
    r.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return r;
  }, [transactions, q, filterAccount, filterType, from, to]);

  const totalsByType = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((t) => { m[t.budgetType] = (m[t.budgetType] || 0) + Math.abs(t.amount); });
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
    setEditing({
      id: "", date: new Date().toISOString().slice(0, 10), amount: 0, details: "",
      account: accounts[0] || "", budgetType: "Expenses", ...preset,
    } as Transaction);
    setDialogOpen(true);
  };
  const openEdit = (t: Transaction) => { setEditing({ ...t }); setDialogOpen(true); };

  const save = () => {
    if (!editing) return;
    if (editing.id) {
      setTransactions((prev) => prev.map((x) => (x.id === editing.id ? editing : x)));
    } else {
      setTransactions((prev) => [{ ...editing, id: uid() }, ...prev]);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Transactions"
        description={`${filtered.length} of ${transactions.length} transactions`}
        actions={
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="h-3.5 w-3.5" />Add Transaction
          </Button>
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
                filterType === t && "border-primary bg-accent"
              )}
            >
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={typeColor[t]}>{typeIcon[t]}</span>{t}
              </div>
              <div className={cn("num font-semibold text-sm mt-0.5", typeColor[t])}>{fmt(totalsByType[t] || 0)}</div>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-lg border bg-card p-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search details..." className="pl-7 h-8" />
            </div>
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" placeholder="From" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" placeholder="To" />
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
                <div className={cn("num text-sm font-semibold", monthTotal >= 0 ? "text-pos" : "text-neg")}>{fmt(monthTotal)}</div>
              </div>
              <ul className="divide-y">
                {items.map((t) => {
                  const errs = validate(t);
                  const eff = effectiveDate(t.date, settings, t.budgetType);
                  const shifted = eff !== t.date;
                  const pos = positions.find((p) => p.id === t.budgetPositionId);
                  return (
                    <li key={t.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20">
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-muted", typeColor[t.budgetType])}>
                        {typeIcon[t.budgetType]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{t.details || <span className="italic text-muted-foreground">No description</span>}</span>
                          {errs.length > 0 && (
                            <Badge variant="outline" className="text-[10px] border-destructive text-destructive gap-1">
                              <AlertCircle className="h-3 w-3" />{errs[0]}
                            </Badge>
                          )}
                          {shifted && (
                            <Badge variant="outline" className="text-[10px] border-warning text-warning">shifted → {eff}</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="num">{t.date}</span>
                          <span>·</span>
                          <span>{t.account}</span>
                          <span>·</span>
                          <span className={typeColor[t.budgetType]}>{t.budgetType}</span>
                          {pos && (<><span>·</span><span>{pos.name}</span></>)}
                        </div>
                      </div>
                      <div className={cn("num text-sm font-semibold tabular-nums", t.amount > 0 ? "text-pos" : t.amount < 0 ? "text-neg" : "")}>{fmt(t.amount)}</div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTransactions((prev) => prev.filter((x) => x.id !== t.id))}>
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

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="h-9 num" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input type="number" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: +e.target.value })} className={cn("h-9 num text-right", editing.amount > 0 ? "text-pos" : editing.amount < 0 ? "text-neg" : "")} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Details</Label>
                <Input value={editing.details} onChange={(e) => setEditing({ ...editing, details: e.target.value })} className="h-9" placeholder="What was this for?" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Account</Label>
                  <Select value={editing.account} onValueChange={(v) => setEditing({ ...editing, account: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{accounts.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={editing.budgetType} onValueChange={(v) => setEditing({ ...editing, budgetType: v as BudgetType, budgetPositionId: undefined })}>
                    <SelectTrigger className={cn("h-9", typeColor[editing.budgetType])}><SelectValue /></SelectTrigger>
                    <SelectContent>{types.map((ty) => (<SelectItem key={ty} value={ty}>{ty}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              {(() => {
                const candidates = positions.filter((p) => p.section === editing.budgetType);
                if (candidates.length === 0) return null;
                return (
                  <div className="space-y-1">
                    <Label className="text-xs">Budget Position</Label>
                    <Select value={editing.budgetPositionId || "none"} onValueChange={(v) => setEditing({ ...editing, budgetPositionId: v === "none" ? undefined : v })}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {candidates.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing?.id ? "Save changes" : "Add transaction"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
