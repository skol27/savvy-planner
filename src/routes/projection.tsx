import { createFileRoute } from "@tanstack/react-router";
import { useFinance, uid } from "@/lib/finance/store";
import { PageHeader } from "@/components/finance/PageHeader";
import { KpiCard } from "@/components/finance/KpiCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertCircle, Pencil, Check } from "lucide-react";
import { fmt, latestTrackedMonth, nwTotals, projectNetWorth } from "@/lib/finance/calc";
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ComposedChart } from "recharts";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/projection")({
  head: () => ({ meta: [{ title: "Projection Planner — Ledger" }, { name: "description", content: "Long-range net worth projection with retirement, inflation, and extra cash flows." }] }),
  component: ProjectionPage,
});

function ProjectionPage() {
  const { projection, setProjection, extras, setExtras, nwPositions, settings, goals } = useFinance();
  const [comparison, setComparison] = useState<string>("CW vs. Actual Exp.");
  const [editExtras, setEditExtras] = useState(false);
  const setP = (patch: Partial<typeof projection>) => setProjection({ ...projection, ...patch });
  const latest = latestTrackedMonth(nwPositions, settings.latestTrackedMode) || "2026-02";
  const startNW = nwTotals(nwPositions, latest).net;
  const startYear = +latest.slice(0,4);
  const proj = useMemo(() => projectNetWorth(projection, startNW, extras, startYear), [projection, startNW, extras, startYear]);
  const final = proj[proj.length-1];
  const birthYear = +projection.birthday.slice(0,4);
  const ageNow = startYear - birthYear;
  const projYearBefore = projection.endYear < startYear;

  const milestones = [
    { label: "Now / Latest", year: startYear, amount: startNW },
    { label: "Retirement", year: projection.retirementYear, amount: proj.find(p=>p.year===projection.retirementYear)?.nw || 0 },
    { label: "End of projection", year: projection.endYear, amount: final?.nw || 0 },
    ...goals.filter(g=>g.show).map(g => {
      const hit = proj.find(p => p.nw >= g.amount);
      return { label: g.name, year: hit?.year || 0, amount: g.amount };
    }),
  ];

  const cfData = proj.map(p => ({ year: p.year, income: p.income, expenses: -p.expenses, net: p.surplus }));
  const metricsData = proj.map(p => {
    let value = 0;
    const cw = p.assets * (projection.irr/100);
    if (comparison === "CW vs. Actual Exp.") value = cw / Math.max(1,p.expenses);
    else if (comparison === "CW vs. Desired Exp.") value = cw / Math.max(1,projection.desiredExpenses);
    else if (comparison === "Act. Vs. Desired Exp.") value = p.expenses / Math.max(1,projection.desiredExpenses);
    else if (comparison === "Actual Exp. vs. NW") value = p.expenses / Math.max(1,p.nw);
    else value = projection.desiredExpenses / Math.max(1,p.nw);
    return { year: p.year, value };
  });

  return (
    <div className="flex flex-col">
      <PageHeader title="Projection Planner" description={`${startYear} → ${projection.endYear} · ${projection.outputMode === "InflAdj" ? "Inflation adjusted" : "Nominal"}`}/>
      <div className="p-6 space-y-4">
        {projYearBefore && <div className="rounded-md border border-destructive bg-destructive/5 p-3 text-xs flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive"/>End-of-projection year cannot be before current year.</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KpiCard label="Age (now)" value={ageNow}/>
          <KpiCard label="Beginning NW" value={fmt(startNW)}/>
          <KpiCard label="End NW" value={fmt(final?.nw || 0)} hint={`@${projection.endYear}`}/>
          <KpiCard label="Total income" value={fmt(proj.reduce((a,p)=>a+p.income,0))}/>
          <KpiCard label="Total expenses" value={fmt(proj.reduce((a,p)=>a+p.expenses,0))}/>
          <KpiCard label="Net contributions" value={fmt(proj.reduce((a,p)=>a+p.surplus,0))}/>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Assumptions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><Label className="text-xs">End year</Label><Input type="number" value={projection.endYear} onChange={e=>setP({endYear:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Output mode</Label>
              <ToggleGroup type="single" size="sm" value={projection.outputMode} onValueChange={v=>v && setP({outputMode: v as any})} className="mt-0.5">
                <ToggleGroupItem value="Nominal">Nominal</ToggleGroupItem><ToggleGroupItem value="InflAdj">Infl. Adj.</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div><Label className="text-xs">Extra CF mode</Label>
              <ToggleGroup type="single" size="sm" value={projection.extraCFMode} onValueChange={v=>v && setP({extraCFMode: v as any})} className="mt-0.5">
                <ToggleGroupItem value="Nominal">Nom</ToggleGroupItem><ToggleGroupItem value="PV">PV</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div><Label className="text-xs">Retirement mode</Label>
              <ToggleGroup type="single" size="sm" value={projection.retirementMode} onValueChange={v=>v && setP({retirementMode: v as any})} className="mt-0.5">
                <ToggleGroupItem value="Nominal">Nom</ToggleGroupItem><ToggleGroupItem value="PV">PV</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div><Label className="text-xs">Initial annual income</Label><Input type="number" value={projection.initialIncome} onChange={e=>setP({initialIncome:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Initial annual expenses</Label><Input type="number" value={projection.initialExpenses} onChange={e=>setP({initialExpenses:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Income growth %</Label><Input type="number" step="0.1" value={projection.incomeGrowth} onChange={e=>setP({incomeGrowth:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Inflation %</Label><Input type="number" step="0.1" value={projection.inflation} onChange={e=>setP({inflation:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Desired exp. (PV)</Label><Input type="number" value={projection.desiredExpenses} onChange={e=>setP({desiredExpenses:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">% surplus → liab</Label><Input type="number" value={projection.surplusToLiab} onChange={e=>setP({surplusToLiab:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">IRR %</Label><Input type="number" step="0.1" value={projection.irr} onChange={e=>setP({irr:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">ECR %</Label><Input type="number" step="0.1" value={projection.ecr} onChange={e=>setP({ecr:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Min principal repay %</Label><Input type="number" value={projection.minPrincipal} onChange={e=>setP({minPrincipal:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Birthday</Label><Input type="date" value={projection.birthday} onChange={e=>setP({birthday: e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Retirement year</Label><Input type="number" value={projection.retirementYear} onChange={e=>setP({retirementYear:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Retirement income</Label><Input type="number" value={projection.retirementIncome} onChange={e=>setP({retirementIncome:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Retirement growth %</Label><Input type="number" step="0.1" value={projection.retirementGrowth} onChange={e=>setP({retirementGrowth:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Tax rate %</Label><Input type="number" value={projection.taxRate} onChange={e=>setP({taxRate:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Taxable fraction %</Label><Input type="number" value={projection.taxableFraction} onChange={e=>setP({taxableFraction:+e.target.value})} className="h-8"/></div>
            <div><Label className="text-xs">Tax-free allow.</Label><Input type="number" value={projection.taxFreeAllowance} onChange={e=>setP({taxFreeAllowance:+e.target.value})} className="h-8"/></div>
            <div className="flex items-end gap-2"><Label className="text-xs">Tax on liquidation</Label><Switch checked={projection.taxOnLiquidation} onCheckedChange={v=>setP({taxOnLiquidation:v})}/></div>
          </div>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="text-sm font-semibold">Extra Cash Flows</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={editExtras ? "default" : "outline"} onClick={() => setEditExtras(e => !e)}>
                {editExtras ? <><Check className="h-3.5 w-3.5"/>Done</> : <><Pencil className="h-3.5 w-3.5"/>Edit</>}
              </Button>
              {editExtras && <Button size="sm" variant="outline" onClick={() => setExtras(p => [...p, { id: uid(), label: "New", type: "Income", amount: 0, startYear, lastYear: startYear, growth: 0, include: true }])}><Plus className="h-3.5 w-3.5"/>Row</Button>}
            </div>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/30"><tr>
              <th className="text-left px-2 py-2">Label</th><th className="text-left px-2 py-2">Type</th>
              <th className="text-right px-2 py-2">Amount</th><th className="text-right px-2 py-2">Start</th>
              <th className="text-right px-2 py-2">Last</th><th className="text-right px-2 py-2">Growth %</th>
              <th className="text-center px-2 py-2">Include</th><th></th>
            </tr></thead>
            <tbody>{extras.map(e => {
              const invalid = e.lastYear < e.startYear;
              return (
                <tr key={e.id} className="border-t">
                  <td className="px-2 py-1">{editExtras ? <Input value={e.label} onChange={ev=>setExtras(p=>p.map(x=>x.id===e.id?{...x,label:ev.target.value}:x))} className="h-7 text-xs"/> : <span>{e.label}</span>}</td>
                  <td className="px-2 py-1">{editExtras ? <Select value={e.type} onValueChange={v=>setExtras(p=>p.map(x=>x.id===e.id?{...x,type:v as any}:x))}><SelectTrigger className="h-7 text-xs"><SelectValue/></SelectTrigger><SelectContent>{["Income","Expenses","Savings"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select> : <span>{e.type}</span>}</td>
                  <td className="px-2 py-1 text-right num">{editExtras ? <Input type="number" value={e.amount} onChange={ev=>setExtras(p=>p.map(x=>x.id===e.id?{...x,amount:+ev.target.value}:x))} className="h-7 text-xs num text-right"/> : fmt(e.amount, 0)}</td>
                  <td className="px-2 py-1 text-right num">{editExtras ? <Input type="number" value={e.startYear} onChange={ev=>setExtras(p=>p.map(x=>x.id===e.id?{...x,startYear:+ev.target.value}:x))} className="h-7 text-xs num text-right w-24"/> : e.startYear}</td>
                  <td className="px-2 py-1 text-right num">{editExtras ? <Input type="number" value={e.lastYear} onChange={ev=>setExtras(p=>p.map(x=>x.id===e.id?{...x,lastYear:+ev.target.value}:x))} className={"h-7 text-xs num text-right w-24"+(invalid?" border-destructive":"")}/> : e.lastYear}</td>
                  <td className="px-2 py-1 text-right num">{editExtras ? <Input type="number" step="0.1" value={e.growth} onChange={ev=>setExtras(p=>p.map(x=>x.id===e.id?{...x,growth:+ev.target.value}:x))} className="h-7 text-xs num text-right w-20"/> : `${e.growth}%`}</td>
                  <td className="text-center"><Switch checked={e.include} disabled={!editExtras} onCheckedChange={v=>setExtras(p=>p.map(x=>x.id===e.id?{...x,include:v}:x))}/></td>
                  <td>{editExtras && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>setExtras(p=>p.filter(x=>x.id!==e.id))}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Net Worth Projection</h3>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={proj}>
                <defs><linearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.4}/><stop offset="100%" stopColor="var(--color-info)" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                <XAxis dataKey="year" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
                <Tooltip contentStyle={{ background:"var(--color-card)", border:"1px solid var(--color-border)", fontSize:11 }}/>
                <Area type="monotone" dataKey="nw" stroke="var(--color-info)" fill="url(#pgrad)" strokeWidth={2}/>
                <ReferenceLine x={projection.retirementYear} stroke="var(--color-warning)" strokeDasharray="3 3" label={{value:"Retire", fontSize:10, fill:"var(--color-warning)"}}/>
                {goals.filter(g=>g.show).map(g => <ReferenceLine key={g.id} y={g.amount} stroke="var(--color-pos)" strokeDasharray="3 3" label={{value:g.name, fontSize:9, fill:"var(--color-pos)"}}/>)}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Cash Flow Projection</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cfData} stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                <XAxis dataKey="year" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
                <Tooltip contentStyle={{ background:"var(--color-card)", border:"1px solid var(--color-border)", fontSize:11 }}/>
                <Legend wrapperStyle={{fontSize:10}}/>
                <Bar dataKey="income" fill="var(--color-pos)" stackId="cf"/>
                <Bar dataKey="expenses" fill="var(--color-neg)" stackId="cf"/>
                <Line dataKey="net" stroke="var(--color-info)" dot={false}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Metrics Projection</h3>
            <Select value={comparison} onValueChange={setComparison}><SelectTrigger className="h-8 w-56"><SelectValue/></SelectTrigger>
              <SelectContent>{["CW vs. Actual Exp.","CW vs. Desired Exp.","Act. Vs. Desired Exp.","Actual Exp. vs. NW","Desired Exp. vs. NW"].map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={metricsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
              <XAxis dataKey="year" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
              <Tooltip contentStyle={{ background:"var(--color-card)", border:"1px solid var(--color-border)", fontSize:11 }}/>
              <Line dataKey="value" stroke="var(--color-info)" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-3 border-b"><h3 className="text-sm font-semibold">Life Events / Milestones</h3></div>
          <table className="w-full text-xs">
            <thead className="bg-muted/30"><tr>
              <th className="text-left px-3 py-2">Label</th><th className="text-right px-3 py-2">Amount</th>
              <th className="text-right px-3 py-2">Year</th><th className="text-right px-3 py-2">Age</th><th className="text-right px-3 py-2">Years left</th>
            </tr></thead>
            <tbody>{milestones.map((m,i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-1.5"><Badge variant="outline">{m.label}</Badge></td>
                <td className="px-3 text-right num">{fmt(m.amount)}</td>
                <td className="px-3 text-right num">{m.year || "—"}</td>
                <td className="px-3 text-right num">{m.year ? m.year - birthYear : "—"}</td>
                <td className="px-3 text-right num">{m.year ? Math.max(0, m.year - startYear) : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
