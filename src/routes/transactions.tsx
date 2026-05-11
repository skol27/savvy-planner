import { createFileRoute } from "@tanstack/react-router";
import { useFinance, uid } from "@/lib/finance/store";
import { PageHeader } from "@/components/finance/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertCircle, Search, ArrowUp, ArrowDown } from "lucide-react";
import { useMemo, useState } from "react";
import { fmt, effectiveDate } from "@/lib/finance/calc";
import type { BudgetType } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Ledger" }, { name: "description", content: "Track every money flow with validation, late-income shifting, and account inference." }] }),
  component: TxPage,
});

const types: BudgetType[] = ["Income","Expenses","Savings","Debt","Transfer","Blank"];
const typeColor: Record<string, string> = {
  Income: "text-pos", Expenses: "text-neg", Savings: "text-info",
  Debt: "text-warning", Transfer: "text-muted-foreground", Blank: "text-muted-foreground"
};

function TxPage() {
  const { transactions, setTransactions, positions, nwPositions, settings } = useFinance();
  const [q, setQ] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortKey, setSortKey] = useState<"date"|"amount"|"account"|"budgetType">("date");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const accounts = nwPositions.map(n => n.name);

  const filtered = useMemo(() => {
    let r = [...transactions];
    if (q) r = r.filter(t => t.details.toLowerCase().includes(q.toLowerCase()));
    if (filterAccount !== "all") r = r.filter(t => t.account === filterAccount);
    if (filterType !== "all") r = r.filter(t => t.budgetType === filterType);
    if (from) r = r.filter(t => t.date >= from);
    if (to) r = r.filter(t => t.date <= to);
    r.sort((a,b) => {
      const av = a[sortKey] as any, bv = b[sortKey] as any;
      const c = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? c : -c;
    });
    return r;
  }, [transactions, q, filterAccount, filterType, sortKey, sortDir, from, to]);

  const totalsByType = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(t => { m[t.budgetType] = (m[t.budgetType] || 0) + Math.abs(t.amount); });
    return m;
  }, [filtered]);

  const validate = (t: typeof transactions[number]) => {
    const errs: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) errs.push("Bad date");
    if (typeof t.amount !== "number" || isNaN(t.amount)) errs.push("Bad amount");
    if (!accounts.includes(t.account)) errs.push("Unknown account");
    if (t.budgetType !== "Transfer" && t.budgetType !== "Blank" && t.budgetPositionId) {
      const pos = positions.find(p => p.id === t.budgetPositionId);
      if (!pos || pos.section !== t.budgetType) errs.push("Position mismatch");
    }
    return errs;
  };

  const addTx = (preset?: Partial<typeof transactions[number]>) => {
    setTransactions(prev => [{ id: uid(), date: new Date().toISOString().slice(0,10), amount: 0, details: "New transaction", account: accounts[0] || "", budgetType: "Expenses", ...preset }, ...prev]);
  };

  const SortBtn = ({ k, label }: { k: typeof sortKey; label: string }) => (
    <button onClick={() => { if (sortKey===k) setSortDir(d => d==="asc"?"desc":"asc"); else { setSortKey(k); setSortDir("desc"); } }}
      className="inline-flex items-center gap-1 hover:text-foreground">
      {label} {sortKey===k && (sortDir==="asc" ? <ArrowUp className="h-3 w-3"/> : <ArrowDown className="h-3 w-3"/>)}
    </button>
  );

  return (
    <div className="flex flex-col">
      <PageHeader title="Transactions" description={`${filtered.length} of ${transactions.length} transactions`} actions={
        <>
          <Button size="sm" variant="outline" onClick={() => addTx({ budgetType: "Income", amount: 100 })}><Plus className="h-3.5 w-3.5"/>Income</Button>
          <Button size="sm" variant="outline" onClick={() => addTx({ budgetType: "Expenses", amount: -50 })}><Plus className="h-3.5 w-3.5"/>Expense</Button>
          <Button size="sm" variant="outline" onClick={() => addTx({ budgetType: "Transfer", amount: -100, details: "Transfer out" })}><Plus className="h-3.5 w-3.5"/>Transfer</Button>
          <Button size="sm" onClick={() => addTx()}><Plus className="h-3.5 w-3.5"/>Generic</Button>
        </>
      }/>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground"/>
            <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search details..." className="pl-7 h-8"/>
          </div>
          <Select value={filterAccount} onValueChange={setFilterAccount}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Account"/></SelectTrigger>
            <SelectContent><SelectItem value="all">All accounts</SelectItem>{accounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Type"/></SelectTrigger>
            <SelectContent><SelectItem value="all">All types</SelectItem>{types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="h-8"/>
          <Input type="date" value={to} onChange={e=>setTo(e.target.value)} className="h-8"/>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          {types.map(t => (
            <div key={t} className="rounded-md border bg-card px-3 py-2">
              <div className="text-muted-foreground">{t}</div>
              <div className={cn("num font-semibold text-sm", typeColor[t])}>{fmt(totalsByType[t] || 0)}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-muted-foreground"><tr>
                <th className="text-left px-2 py-2 font-medium"><SortBtn k="date" label="Date"/></th>
                <th className="text-right px-2 py-2 font-medium"><SortBtn k="amount" label="Amount"/></th>
                <th className="text-left px-2 py-2 font-medium">Details</th>
                <th className="text-left px-2 py-2 font-medium"><SortBtn k="account" label="Account"/></th>
                <th className="text-left px-2 py-2 font-medium"><SortBtn k="budgetType" label="Type"/></th>
                <th className="text-left px-2 py-2 font-medium">Position</th>
                <th className="text-left px-2 py-2 font-medium">Eff. Date</th>
                <th className="text-left px-2 py-2 font-medium">Status</th>
                <th className="w-8"></th>
              </tr></thead>
              <tbody>
                {filtered.map(t => {
                  const errs = validate(t);
                  const eff = effectiveDate(t.date, settings, t.budgetType);
                  const shifted = eff !== t.date;
                  const candidatePositions = positions.filter(p => p.section === t.budgetType);
                  return (
                    <tr key={t.id} className="border-t hover:bg-muted/20">
                      <td className="px-2 py-1"><Input type="date" value={t.date} onChange={e => setTransactions(prev => prev.map(x => x.id===t.id ? {...x, date: e.target.value} : x))} className="h-7 text-xs num w-32"/></td>
                      <td className="px-2 py-1"><Input type="number" value={t.amount} onChange={e => setTransactions(prev => prev.map(x => x.id===t.id ? {...x, amount: +e.target.value} : x))} className={cn("h-7 text-xs num text-right w-24", t.amount > 0 ? "text-pos" : t.amount < 0 ? "text-neg" : "")}/></td>
                      <td className="px-2 py-1"><Input value={t.details} onChange={e => setTransactions(prev => prev.map(x => x.id===t.id ? {...x, details: e.target.value} : x))} className="h-7 text-xs min-w-40"/></td>
                      <td className="px-2 py-1">
                        <Select value={t.account} onValueChange={v => setTransactions(prev => prev.map(x => x.id===t.id ? {...x, account: v} : x))}>
                          <SelectTrigger className={cn("h-7 text-xs", !accounts.includes(t.account) && "border-destructive")}><SelectValue/></SelectTrigger>
                          <SelectContent>{accounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1">
                        <Select value={t.budgetType} onValueChange={v => setTransactions(prev => prev.map(x => x.id===t.id ? {...x, budgetType: v as any, budgetPositionId: undefined} : x))}>
                          <SelectTrigger className={cn("h-7 text-xs", typeColor[t.budgetType])}><SelectValue/></SelectTrigger>
                          <SelectContent>{types.map(ty => <SelectItem key={ty} value={ty}>{ty}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1">
                        {candidatePositions.length > 0 ? (
                          <Select value={t.budgetPositionId || "none"} onValueChange={v => setTransactions(prev => prev.map(x => x.id===t.id ? {...x, budgetPositionId: v === "none" ? undefined : v} : x))}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—"/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {candidatePositions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-1 num">
                        {eff}{shifted && <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1 border-warning text-warning">shifted</Badge>}
                      </td>
                      <td className="px-2 py-1">
                        {errs.length === 0 ? <Badge variant="outline" className="text-[10px] border-pos text-pos">OK</Badge>
                          : <Badge variant="outline" className="text-[10px] border-destructive text-destructive gap-1"><AlertCircle className="h-3 w-3"/>{errs[0]}</Badge>}
                      </td>
                      <td><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTransactions(prev => prev.filter(x => x.id !== t.id))}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button></td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No transactions match filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
