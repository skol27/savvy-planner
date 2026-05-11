import { createFileRoute } from "@tanstack/react-router";
import { useFinance, uid, monthsRange } from "@/lib/finance/store";
import { PageHeader } from "@/components/finance/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Check } from "lucide-react";
import { useState } from "react";
import { fmt, latestTrackedMonth, nwTotals } from "@/lib/finance/calc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/networth")({
  head: () => ({ meta: [{ title: "Net Worth Tracker — Ledger" }, { name: "description", content: "Track monthly balances of all assets and liabilities." }] }),
  component: NWPage,
});

function NWPage() {
  const { nwPositions, setNwPositions, assetCats, liabCats, settings } = useFinance();
  const months = monthsRange(settings.startingYear, settings.startingMonth, 24);
  const [from, setFrom] = useState(0);
  const [edit, setEdit] = useState(false);
  const visible = months.slice(from, from + 6);
  const latest = latestTrackedMonth(nwPositions, settings.latestTrackedMode);

  const monthStatus = (m: string): { label: string; cls: string } => {
    const has = nwPositions.some(p => (p.balances[m] || 0) !== 0);
    if (m === latest) return { label: "Latest", cls: "border-info text-info" };
    if (!has) return { label: "Empty", cls: "border-muted-foreground text-muted-foreground" };
    return { label: "Tracked", cls: "border-pos text-pos" };
  };

  const addPos = (type: "Asset" | "Liability") => {
    const cats = type === "Asset" ? assetCats : liabCats;
    if (!cats[0]) return;
    setNwPositions(p => [...p, { id: uid(), type, categoryId: cats[0].id, name: `New ${type}`, balances: {} }]);
  };

  const Section = ({ type }: { type: "Asset" | "Liability" }) => {
    const rows = nwPositions.filter(p => p.type === type);
    const cats = type === "Asset" ? assetCats : liabCats;
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">{type === "Asset" ? "Assets" : "Liabilities"} <span className="text-xs text-muted-foreground font-normal">({rows.length})</span></h3>
          {edit && <Button size="sm" variant="outline" onClick={() => addPos(type)}><Plus className="h-3.5 w-3.5"/>{type}</Button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/20"><tr>
              <th className="text-left px-2 py-1.5 font-medium w-44">Category</th>
              <th className="text-left px-2 py-1.5 font-medium w-44">Name</th>
              {visible.map(m => <th key={m} className="text-right px-2 py-1.5 font-medium w-24">{m.slice(2)}</th>)}
              <th className="w-8"></th>
            </tr></thead>
            <tbody>
              {rows.map(p => {
                const cat = cats.find(c => c.id === p.categoryId);
                const matches = !!cat;
                return (
                  <tr key={p.id} className="border-t hover:bg-muted/20">
                    <td className="px-2 py-1">
                      {edit ? (
                        <Select value={p.categoryId} onValueChange={v => setNwPositions(prev => prev.map(x => x.id===p.id ? {...x, categoryId: v} : x))}>
                          <SelectTrigger className={cn("h-7 text-xs", !matches && "border-destructive")}><SelectValue/></SelectTrigger>
                          <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (<span className="text-xs">{cat?.name ?? "—"}</span>)}
                    </td>
                    <td className="px-2 py-1">{edit ? <Input value={p.name} onChange={e => setNwPositions(prev => prev.map(x => x.id===p.id ? {...x, name: e.target.value} : x))} className="h-7 text-xs"/> : <span className="text-xs">{p.name}</span>}</td>
                    {visible.map(m => (
                      <td key={m} className="px-1 py-1">
                        {edit ? (
                          <Input type="number" value={p.balances[m] ?? ""} onChange={e => setNwPositions(prev => prev.map(x => x.id===p.id ? {...x, balances: { ...x.balances, [m]: e.target.value === "" ? 0 : +e.target.value }} : x))} className="h-7 text-xs num text-right px-1"/>
                        ) : (
                          <div className="text-xs num text-right px-1">{p.balances[m] ? fmt(p.balances[m], 0) : "—"}</div>
                        )}
                      </td>
                    ))}
                    <td>{edit && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setNwPositions(prev => prev.filter(x => x.id !== p.id))}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button>}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={visible.length+3} className="text-center py-6 text-muted-foreground">No {type.toLowerCase()}s.</td></tr>}
              <tr className="border-t bg-muted/20 font-semibold">
                <td colSpan={2} className="px-2 py-1.5 text-right">Total</td>
                {visible.map(m => {
                  const sum = rows.reduce((a, p) => a + (p.balances[m] || 0), 0);
                  return <td key={m} className="px-2 py-1.5 text-right num">{fmt(sum)}</td>;
                })}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <PageHeader title="Net Worth Tracker" description={`Latest tracked: ${latest || "—"} (${settings.latestTrackedMode} mode)`} actions={
        <>
          <Button size="sm" variant={edit ? "default" : "outline"} onClick={() => setEdit(e => !e)}>
            {edit ? <><Check className="h-3.5 w-3.5"/>Done</> : <><Pencil className="h-3.5 w-3.5"/>Edit</>}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFrom(Math.max(0, from - 6))}>← Earlier</Button>
          <Button size="sm" variant="outline" onClick={() => setFrom(Math.min(months.length - 6, from + 6))}>Later →</Button>
        </>
      }/>
      <div className="p-6 space-y-4">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Month status</div>
          <div className="flex flex-wrap gap-1">
            {visible.map(m => {
              const s = monthStatus(m);
              const t = nwTotals(nwPositions, m);
              return (
                <div key={m} className="rounded-md border px-2 py-1 text-xs">
                  <div className="num font-medium">{m}</div>
                  <Badge variant="outline" className={cn("text-[10px] mt-0.5", s.cls)}>{s.label}</Badge>
                  <div className="num text-[10px] text-muted-foreground mt-0.5">NW {fmt(t.net)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <Section type="Asset"/>
        <Section type="Liability"/>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase">Total Assets ({latest || "—"})</div>
            <div className="num text-2xl font-semibold text-pos">{fmt(latest ? nwTotals(nwPositions, latest).assets : 0)}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase">Total Liabilities</div>
            <div className="num text-2xl font-semibold text-neg">{fmt(latest ? nwTotals(nwPositions, latest).liab : 0)}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase">Net Worth</div>
            <div className="num text-2xl font-semibold">{fmt(latest ? nwTotals(nwPositions, latest).net : 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
