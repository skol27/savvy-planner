import { createFileRoute } from "@tanstack/react-router";
import { useFinance, uid } from "@/lib/finance/store";
import { PageHeader } from "@/components/finance/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { fmt, latestTrackedMonth, nwTotals, projectNetWorth } from "@/lib/finance/calc";

export const Route = createFileRoute("/goals")({
  head: () => ({ meta: [{ title: "Goals — Ledger" }, { name: "description", content: "Net worth goals, FIRE targets, and custom milestones." }] }),
  component: GoalsPage,
});

function GoalsPage() {
  const { goals, setGoals, nwPositions, settings, projection, extras } = useFinance();
  const latest = latestTrackedMonth(nwPositions, settings.latestTrackedMode) || "2026-02";
  const nw = nwTotals(nwPositions, latest).net;
  const proj = projectNetWorth(projection, nw, extras, +latest.slice(0,4));
  return (
    <div className="flex flex-col">
      <PageHeader title="Goals" description="Net worth targets used by dashboards and projections." actions={
        <Button size="sm" onClick={() => setGoals(p => [...p, { id: uid(), name: "New Goal", amount: 50000, show: true, type: "Custom" }])}><Plus className="h-3.5 w-3.5"/>Goal</Button>
      }/>
      <div className="p-6">
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs"><tr>
              <th className="text-left px-3 py-2">Goal</th><th className="text-left px-3 py-2">Type</th>
              <th className="text-right px-3 py-2">Amount</th><th className="text-right px-3 py-2">Completion</th>
              <th className="text-right px-3 py-2">Projected reach</th><th className="text-right px-3 py-2">Target date</th>
              <th className="text-center px-3 py-2">Show</th><th></th>
            </tr></thead>
            <tbody>{goals.map(g => {
              const pct = Math.min(100, (nw / g.amount) * 100);
              const reach = proj.find(p => p.nw >= g.amount);
              return (
                <tr key={g.id} className="border-t">
                  <td className="px-3 py-1.5"><Input value={g.name} onChange={e=>setGoals(p=>p.map(x=>x.id===g.id?{...x,name:e.target.value}:x))} className="h-8"/></td>
                  <td className="px-3"><Select value={g.type} onValueChange={v=>setGoals(p=>p.map(x=>x.id===g.id?{...x,type:v as any}:x))}>
                    <SelectTrigger className="h-8 w-32"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="NW">Net worth</SelectItem><SelectItem value="FIRE">FIRE</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent>
                  </Select></td>
                  <td className="px-3"><Input type="number" value={g.amount} onChange={e=>setGoals(p=>p.map(x=>x.id===g.id?{...x,amount:+e.target.value}:x))} className="h-8 num text-right w-32"/></td>
                  <td className="px-3 text-right num">
                    <div className="inline-flex flex-col items-end">
                      <span>{pct.toFixed(0)}%</span>
                      <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                        <div className="h-full bg-pos" style={{ width: `${pct}%` }}/>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 text-right num">{reach?.year || "—"}</td>
                  <td className="px-3"><Input type="date" value={g.targetDate || ""} onChange={e=>setGoals(p=>p.map(x=>x.id===g.id?{...x,targetDate:e.target.value}:x))} className="h-8 num"/></td>
                  <td className="text-center"><Switch checked={g.show} onCheckedChange={v=>setGoals(p=>p.map(x=>x.id===g.id?{...x,show:v}:x))}/></td>
                  <td><Button size="icon" variant="ghost" className="h-8 w-8" onClick={()=>setGoals(p=>p.filter(x=>x.id!==g.id))}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">Current net worth: <span className="num font-semibold text-foreground">{fmt(nw)}</span> · Goals with "Show" enabled appear on Net Worth Dashboard and Projection charts.</div>
      </div>
    </div>
  );
}
