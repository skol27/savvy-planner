import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance/store";
import { PageHeader } from "@/components/finance/PageHeader";
import { KpiCard } from "@/components/finance/KpiCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { fmt, latestTrackedMonth, nwTotals, irrApprox } from "@/lib/finance/calc";
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ComposedChart } from "recharts";

export const Route = createFileRoute("/networth-dashboard")({
  head: () => ({ meta: [{ title: "Net Worth Dashboard — Ledger" }, { name: "description", content: "Net worth, allocation, IRR/ECR, contributions, and goal analysis." }] }),
  component: NWDashboard,
});
const COLORS = ["#10b981","#3b82f6","#f59e0b","#8b5cf6","#06b6d4","#ec4899","#84cc16","#ef4444","#f97316"];

function NWDashboard() {
  const { nwPositions, transactions, settings, goals, setGoals, assetCats, liabCats } = useFinance();
  const months = useMemo(() => [...new Set(nwPositions.flatMap(p => Object.keys(p.balances)))].sort(), [nwPositions]);
  const latest = latestTrackedMonth(nwPositions, settings.latestTrackedMode) || months[months.length-1] || "2026-02";
  const [from, setFrom] = useState(months[0] || "2026-02");
  const [to, setTo] = useState(latest);
  const [detail, setDetail] = useState<"Categories"|"Positions">("Positions");
  const [sortBy, setSortBy] = useState<"Value"|"Start"|"Contrib"|"Gain"|"IRR">("Value");
  const [horizon, setHorizon] = useState<"All"|"ST"|"LT">("All");
  const [type, setType] = useState<"Assets"|"Liabilities">("Assets");
  const [runway, setRunway] = useState(12);
  const [monthlyReturn, setMonthlyReturn] = useState(0.4);
  const [monthlyWithdraw, setMonthlyWithdraw] = useState(2000);

  const start = nwTotals(nwPositions, from);
  const end = nwTotals(nwPositions, to);
  const periods = months.indexOf(to) - months.indexOf(from) + 1;
  const contribs = transactions.filter(t => {
    const mk = t.date.slice(0,7); return mk >= from && mk <= to && (t.budgetType==="Savings"||t.budgetType==="Debt");
  }).reduce((a,t) => a + Math.abs(t.amount), 0);
  const gain = end.assets - start.assets - contribs;
  const cost = end.liab - start.liab + contribs;
  const irr = irrApprox(start.assets, end.assets, contribs, periods);
  const ecr = irrApprox(start.liab, end.liab, -contribs, periods);
  const netLeverage = end.assets ? end.liab / end.assets : 0;

  const series = months.map(m => {
    const t = nwTotals(nwPositions, m);
    return { month: m.slice(2), nw: t.net, assets: t.assets, liab: t.liab, contrib: contribs * (months.indexOf(m)/Math.max(1,months.length-1)) };
  });

  const allocAssets = nwPositions.filter(p => p.type === "Asset").map(p => ({ name: p.name, value: p.balances[to] || 0 })).filter(x => x.value > 0);
  const allocLiab = nwPositions.filter(p => p.type === "Liability").map(p => ({ name: p.name, value: p.balances[to] || 0 })).filter(x => x.value > 0);

  const detailRows = useMemo(() => {
    const items = type === "Assets" ? nwPositions.filter(p=>p.type==="Asset") : nwPositions.filter(p=>p.type==="Liability");
    const cats = type === "Assets" ? assetCats : liabCats;
    const filtered = items.filter(p => {
      if (horizon === "All") return true;
      const c = cats.find(c => c.id === p.categoryId);
      return c?.horizon === horizon;
    });
    const rows = filtered.map(p => {
      const startV = p.balances[from] || 0;
      const endV = p.balances[to] || 0;
      const contrib = transactions.filter(t => t.account === p.name && t.date.slice(0,7) >= from && t.date.slice(0,7) <= to).reduce((a,t)=>a+t.amount,0);
      const g = endV - startV - contrib;
      const r = irrApprox(Math.abs(startV), Math.abs(endV), contrib, periods);
      return { name: p.name, current: endV, start: startV, contrib, gain: g, irr: r };
    });
    rows.sort((a,b) => {
      const map = { Value: "current", Start: "start", Contrib: "contrib", Gain: "gain", IRR: "irr" } as const;
      return (b as any)[map[sortBy]] - (a as any)[map[sortBy]];
    });
    return rows;
  }, [nwPositions, type, horizon, sortBy, from, to, periods, assetCats, liabCats, transactions]);

  const totalCurrent = detailRows.reduce((a,r)=>a+r.current,0);

  return (
    <div className="flex flex-col">
      <PageHeader title="Net Worth Dashboard" description={`${from} → ${to}`} actions={
        <>
          <Select value={from} onValueChange={setFrom}><SelectTrigger className="h-8 w-32"><SelectValue/></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
          <span className="text-xs">→</span>
          <Select value={to} onValueChange={setTo}><SelectTrigger className="h-8 w-32"><SelectValue/></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
        </>
      }/>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiCard label="Focus Month" value={to}/>
          <KpiCard label="Net Worth" value={fmt(end.net)}/>
          <KpiCard label="Assets" value={fmt(end.assets)} trend="pos"/>
          <KpiCard label="Liabilities" value={fmt(end.liab)} trend="neg"/>
          <KpiCard label="Net Leverage" value={`${(netLeverage*100).toFixed(1)}%`}/>
          <KpiCard label="IRR" value={settings.irrEcr ? `${(irr*100).toFixed(1)}%` : "—"} hint={settings.irrEcr?"":"Disabled in settings"}/>
          <KpiCard label="ECR" value={settings.irrEcr ? `${(ecr*100).toFixed(1)}%` : "—"}/>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Net Worth Development</h3>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={series}>
                <defs><linearGradient id="nw2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.4}/><stop offset="100%" stopColor="var(--color-info)" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                <XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
                <Tooltip contentStyle={{ background:"var(--color-card)", border:"1px solid var(--color-border)", fontSize:11 }}/>
                <Area type="monotone" dataKey="nw" fill="url(#nw2)" stroke="var(--color-info)" strokeWidth={2}/>
                <Bar dataKey="contrib" fill="var(--color-pos)" opacity={0.4}/>
                {goals.filter(g=>g.show).map(g => <ReferenceLine key={g.id} y={g.amount} stroke="var(--color-warning)" strokeDasharray="3 3" label={{value:g.name, fontSize:10, fill:"var(--color-warning)", position:"insideTopRight"}}/>)}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Assets vs Liabilities</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                <XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
                <Tooltip contentStyle={{ background:"var(--color-card)", border:"1px solid var(--color-border)", fontSize:11 }}/>
                <Legend wrapperStyle={{fontSize:10}}/>
                <Line dataKey="assets" stroke="var(--color-pos)" strokeWidth={2} dot={false}/>
                <Line dataKey="liab" stroke="var(--color-neg)" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[{title:"Asset Allocation", data: allocAssets}, {title:"Liability Allocation", data: allocLiab}].map((d,i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-semibold mb-2">{d.title}</h3>
              {d.data.length === 0 ? <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">No data</div> :
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={d.data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {d.data.map((_,j) => <Cell key={j} fill={COLORS[j%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ background:"var(--color-card)", border:"1px solid var(--color-border)", fontSize:11 }}/>
                  <Legend wrapperStyle={{fontSize:10}}/>
                </PieChart>
              </ResponsiveContainer>}
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b">
            <h3 className="text-sm font-semibold mr-auto">Detailed Analysis</h3>
            <ToggleGroup type="single" size="sm" value={type} onValueChange={v=>v && setType(v as any)}><ToggleGroupItem value="Assets">Assets</ToggleGroupItem><ToggleGroupItem value="Liabilities">Liabilities</ToggleGroupItem></ToggleGroup>
            <ToggleGroup type="single" size="sm" value={horizon} onValueChange={v=>v && setHorizon(v as any)}><ToggleGroupItem value="All">All</ToggleGroupItem><ToggleGroupItem value="ST">ST</ToggleGroupItem><ToggleGroupItem value="LT">LT</ToggleGroupItem></ToggleGroup>
            <ToggleGroup type="single" size="sm" value={detail} onValueChange={v=>v && setDetail(v as any)}><ToggleGroupItem value="Categories">Cat</ToggleGroupItem><ToggleGroupItem value="Positions">Pos</ToggleGroupItem></ToggleGroup>
            <Select value={sortBy} onValueChange={v=>setSortBy(v as any)}><SelectTrigger className="h-8 w-28"><SelectValue/></SelectTrigger><SelectContent>{["Value","Start","Contrib","Gain","IRR"].map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="border-r">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={detailRows.slice(0,8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                  <XAxis type="number" tick={{fontSize:10}}/><YAxis type="category" dataKey="name" tick={{fontSize:10}} width={100}/>
                  <Tooltip contentStyle={{ background:"var(--color-card)", border:"1px solid var(--color-border)", fontSize:11 }}/>
                  <Bar dataKey="current" fill={type==="Assets"?"var(--color-pos)":"var(--color-neg)"} radius={[0,3,3,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-muted/30"><tr>
                <th className="text-left px-2 py-2 font-medium">Position</th>
                <th className="text-right px-2 py-2 font-medium">Current</th>
                <th className="text-right px-2 py-2 font-medium">Share</th>
                <th className="text-right px-2 py-2 font-medium">Start</th>
                <th className="text-right px-2 py-2 font-medium">Contrib</th>
                <th className="text-right px-2 py-2 font-medium">{type==="Assets"?"Gain":"Cost"}</th>
                <th className="text-right px-2 py-2 font-medium">{type==="Assets"?"IRR":"ECR"}</th>
              </tr></thead>
              <tbody>{detailRows.map(r => (
                <tr key={r.name} className="border-t hover:bg-muted/20">
                  <td className="px-2 py-1">{r.name}</td>
                  <td className="px-2 text-right num">{fmt(r.current)}</td>
                  <td className="px-2 text-right num text-muted-foreground">{totalCurrent ? `${(r.current/totalCurrent*100).toFixed(0)}%` : "—"}</td>
                  <td className="px-2 text-right num">{fmt(r.start)}</td>
                  <td className="px-2 text-right num">{fmt(r.contrib)}</td>
                  <td className="px-2 text-right num">{fmt(r.gain)}</td>
                  <td className="px-2 text-right num">{settings.irrEcr ? `${(r.irr*100).toFixed(1)}%` : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="p-3 border-b"><h3 className="text-sm font-semibold">Goal Analysis</h3></div>
            <table className="w-full text-xs">
              <thead className="bg-muted/30"><tr>
                <th className="text-left px-3 py-2">Goal</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-right px-3 py-2">Compl.</th>
                <th className="text-center px-3 py-2">Show</th>
              </tr></thead>
              <tbody>{goals.map(g => (
                <tr key={g.id} className="border-t">
                  <td className="px-3 py-1.5">{g.name}</td>
                  <td className="px-3 text-right num">{fmt(g.amount)}</td>
                  <td className="px-3 text-right num">{`${Math.min(100,(end.net/g.amount)*100).toFixed(0)}%`}</td>
                  <td className="text-center"><Switch checked={g.show} onCheckedChange={v => setGoals(prev => prev.map(x => x.id===g.id ? {...x, show: v} : x))}/></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Custom KPIs (assumptions)</h3>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><label className="text-muted-foreground">Runway (months)</label><Input type="number" value={runway} onChange={e=>setRunway(+e.target.value)} className="h-8 mt-1"/></div>
              <div><label className="text-muted-foreground">Monthly return %</label><Input type="number" step="0.1" value={monthlyReturn} onChange={e=>setMonthlyReturn(+e.target.value)} className="h-8 mt-1"/></div>
              <div><label className="text-muted-foreground">Monthly withdraw</label><Input type="number" value={monthlyWithdraw} onChange={e=>setMonthlyWithdraw(+e.target.value)} className="h-8 mt-1"/></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <KpiCard label={`After ${runway}m`} value={fmt(end.net * Math.pow(1 + monthlyReturn/100, runway) - monthlyWithdraw*runway)}/>
              <KpiCard label="Sustainable / mo" value={fmt(end.net * monthlyReturn/100)}/>
              <KpiCard label="Months to zero" value={Math.max(0,Math.round(end.net/monthlyWithdraw))}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
