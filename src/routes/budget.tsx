import { createFileRoute } from "@tanstack/react-router";
import { useFinance, uid } from "@/lib/finance/store";
import { PageHeader } from "@/components/finance/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { fmt } from "@/lib/finance/calc";
import type { BudgetSection } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/budget")({
  head: () => ({ meta: [{ title: "Budget Planner — Ledger" }, { name: "description", content: "Plan monthly budget positions across income, expenses, savings, and debt." }] }),
  component: BudgetPage,
});

const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function BudgetPage() {
  const { positions, setPositions, budgetCats, settings } = useFinance();
  const [year, setYear] = useState(settings.startingYear);
  const [view, setView] = useState<"Monthly"|"Annual"|"Horizon">("Monthly");
  const sections: BudgetSection[] = ["Income","Expenses","Savings","Debt"];
  const sectionTotal = (sec: BudgetSection) => positions.filter(p => p.section === sec).reduce((a,p) => a + p.monthly.reduce((x,y)=>x+y,0), 0);
  const allocated = sectionTotal("Income") - sectionTotal("Expenses") - sectionTotal("Savings") - sectionTotal("Debt");
  const monthlyAllocated = allocated / 12;

  const addPosition = (sec: BudgetSection) => {
    const cat = budgetCats.find(c => c.section === sec);
    if (!cat) return;
    setPositions(prev => [...prev, { id: uid(), section: sec, categoryId: cat.id, name: "New Position", monthly: Array(12).fill(0) }]);
  };

  return (
    <div className="flex flex-col">
      <PageHeader title="Budget Planner" description={`Plan ${year} across all categories`} actions={
        <>
          <ToggleGroup type="single" size="sm" value={view} onValueChange={v => v && setView(v as any)}>
            <ToggleGroupItem value="Monthly">Monthly</ToggleGroupItem>
            <ToggleGroupItem value="Annual">Annual</ToggleGroupItem>
            <ToggleGroupItem value="Horizon">10-Year</ToggleGroupItem>
          </ToggleGroup>
          <Select value={String(year)} onValueChange={v => setYear(+v)}>
            <SelectTrigger className="w-28 h-8"><SelectValue/></SelectTrigger>
            <SelectContent>{Array.from({length:10},(_,i)=>settings.startingYear+i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </>
      }/>
      <div className="p-6 space-y-4">
        <div className={cn("rounded-lg border p-4 flex items-center justify-between", monthlyAllocated < 0 ? "border-destructive bg-destructive/5" : "bg-card")}>
          <div className="flex items-center gap-3">
            {monthlyAllocated < 0 && <AlertTriangle className="h-4 w-4 text-destructive"/>}
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">To be allocated (monthly avg)</div>
              <div className={cn("num text-2xl font-semibold", monthlyAllocated < 0 ? "text-destructive" : "text-pos")}>{fmt(monthlyAllocated, 0)}</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-6 text-xs">
            {sections.map(s => <div key={s}><div className="text-muted-foreground">{s}/yr</div><div className="num font-semibold">{fmt(sectionTotal(s))}</div></div>)}
          </div>
        </div>

        {sections.map(sec => {
          const rows = positions.filter(p => p.section === sec);
          const annualSec = rows.reduce((a,r)=>a+r.monthly.reduce((x,y)=>x+y,0),0);
          const cats = budgetCats.filter(c => c.section === sec);
          return (
            <div key={sec} className="rounded-lg border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-semibold">{sec}</Badge>
                  <span className="text-xs text-muted-foreground">{rows.length} positions • Annual {fmt(annualSec)}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => addPosition(sec)}><Plus className="h-3.5 w-3.5"/>Position</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20"><tr>
                    <th className="text-left px-2 py-1.5 font-medium w-40">Category</th>
                    <th className="text-left px-2 py-1.5 font-medium w-44">Position</th>
                    {view === "Monthly" && M.map(m => <th key={m} className="text-right px-1 py-1.5 font-medium w-16">{m}</th>)}
                    <th className="text-right px-2 py-1.5 font-medium">Annual</th>
                    <th className="w-8"></th>
                  </tr></thead>
                  <tbody>
                    {rows.map(p => {
                      const cat = budgetCats.find(c => c.id === p.categoryId);
                      const matches = cat?.section === sec;
                      const annual = p.monthly.reduce((a,b)=>a+b,0);
                      return (
                        <tr key={p.id} className="border-t hover:bg-muted/20">
                          <td className="px-2 py-1">
                            <Select value={p.categoryId} onValueChange={v => setPositions(prev => prev.map(x => x.id===p.id ? {...x, categoryId: v} : x))}>
                              <SelectTrigger className={cn("h-7 text-xs", !matches && "border-destructive")}><SelectValue/></SelectTrigger>
                              <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                            {!matches && <div className="text-[10px] text-destructive mt-0.5">Wrong section</div>}
                          </td>
                          <td className="px-2 py-1"><Input value={p.name} onChange={e => setPositions(prev => prev.map(x => x.id===p.id ? {...x, name: e.target.value} : x))} className="h-7 text-xs"/></td>
                          {view === "Monthly" && p.monthly.map((v, i) => (
                            <td key={i} className="px-1 py-1">
                              <Input type="number" value={v} onChange={e => setPositions(prev => prev.map(x => x.id===p.id ? {...x, monthly: x.monthly.map((mv, mi) => mi === i ? +e.target.value : mv)} : x))} className="h-7 text-xs num text-right px-1"/>
                            </td>
                          ))}
                          <td className="px-2 py-1 text-right num font-semibold">{fmt(annual)}</td>
                          <td><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPositions(prev => prev.filter(x => x.id !== p.id))}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button></td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && <tr><td colSpan={20} className="text-center py-6 text-muted-foreground">No positions. Click "Position" to add one.</td></tr>}
                    <tr className="border-t bg-muted/20 font-semibold">
                      <td colSpan={view === "Monthly" ? 14 : 2} className="px-2 py-1.5 text-right">Section Total:</td>
                      <td className="px-2 py-1.5 text-right num">{fmt(annualSec)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
