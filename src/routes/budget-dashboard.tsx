import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance/store";
import { PageHeader } from "@/components/finance/PageHeader";
import { KpiCard } from "@/components/finance/KpiCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMemo, useState } from "react";
import { fmt, monthKey, effectiveDate } from "@/lib/finance/calc";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { cn } from "@/lib/utils";
import type { BudgetSection } from "@/lib/finance/types";

export const Route = createFileRoute("/budget-dashboard")({
  head: () => ({ meta: [{ title: "Budget Dashboard — Ledger" }, { name: "description", content: "Tracked vs budget, allocation, and account insights." }] }),
  component: BudgetDashboard,
});

const COLORS = ["#10b981","#ef4444","#3b82f6","#f59e0b","#8b5cf6","#06b6d4","#ec4899","#84cc16","#f97316","#6366f1"];

function BudgetDashboard() {
  const { positions, transactions, budgetCats, settings, nwPositions, assetCats, liabCats } = useFinance();
  const [year, setYear] = useState(2026);
  const [period, setPeriod] = useState<"Year"|"YTD"|"Month">("Month");
  const [selectedMonth, setSelectedMonth] = useState(2);
  const [detail, setDetail] = useState<"Categories"|"Positions">("Positions");
  const [series, setSeries] = useState({ Normalized:false, Budget:true, Income:true, Expenses:true, Savings:true, Debt:true });
  const [rateMode, setRateMode] = useState<"Expenses"|"Savings"|"Debt"|"Sav.+Debt">("Sav.+Debt");
  const [acctView, setAcctView] = useState("High-Level");
  const [acctSort, setAcctSort] = useState<"CF"|"Tx"|"Vol"|"Net">("CF");

  const periodFrom = period === "Year" ? `${year}-01` : period === "YTD" ? `${year}-01` : `${year}-${String(selectedMonth).padStart(2,"0")}`;
  const periodTo = period === "Month" ? `${year}-${String(selectedMonth).padStart(2,"0")}` : `${year}-12`;

  const inPeriod = useMemo(() => transactions.filter(t => {
    const ed = effectiveDate(t.date, settings, t.budgetType);
    const mk = monthKey(ed);
    return mk >= periodFrom && mk <= periodTo;
  }), [transactions, periodFrom, periodTo, settings]);

  const trackedBySection = (s: BudgetSection) => inPeriod.filter(t => t.budgetType === s).reduce((a,t) => a + Math.abs(t.amount), 0);
  const periodMonths = period === "Month" ? 1 : period === "YTD" ? Math.max(1, new Date().getMonth() + 1) : 12;
  const budgetBySection = (s: BudgetSection) => positions.filter(p => p.section === s).reduce((a,p) => a + p.monthly.slice(0, periodMonths).reduce((x,y)=>x+y,0), 0);

  const income = trackedBySection("Income"), expenses = trackedBySection("Expenses"), savings = trackedBySection("Savings"), debt = trackedBySection("Debt");
  const sdRate = income ? (savings + debt) / income : 0;
  const planIncome = budgetBySection("Income"), planExpenses = budgetBySection("Expenses"), planSavings = budgetBySection("Savings"), planDebt = budgetBySection("Debt");
  const balance = income - expenses - savings - debt;
  const planBalance = planIncome - planExpenses - planSavings - planDebt;
  const completion = planExpenses ? (expenses / planExpenses) * 100 : 0;

  const breakdown = (sec: BudgetSection) => {
    const pos = positions.filter(p => p.section === sec);
    if (detail === "Positions") {
      return pos.map(p => {
        const tracked = inPeriod.filter(t => t.budgetPositionId === p.id).reduce((a,t) => a + Math.abs(t.amount), 0);
        const budget = p.monthly.slice(0, periodMonths).reduce((x,y)=>x+y,0);
        return { id: p.id, name: p.name, tracked, budget };
      });
    }
    const groups = new Map<string, { name: string; tracked: number; budget: number }>();
    pos.forEach(p => {
      const c = budgetCats.find(c => c.id === p.categoryId);
      const k = c?.name || "—";
      const tracked = inPeriod.filter(t => t.budgetPositionId === p.id).reduce((a,t) => a + Math.abs(t.amount), 0);
      const budget = p.monthly.slice(0, periodMonths).reduce((x,y)=>x+y,0);
      const cur = groups.get(k) || { name: k, tracked: 0, budget: 0 };
      cur.tracked += tracked; cur.budget += budget;
      groups.set(k, cur);
    });
    return [...groups.values()];
  };

  const allMonths = Array.from({length:12},(_,i)=>i);
  const trackVsBudget = allMonths.map(i => {
    const mk = `${year}-${String(i+1).padStart(2,"0")}`;
    const m = inPeriod.filter(t => monthKey(effectiveDate(t.date, settings, t.budgetType)) === mk);
    const tIn = m.filter(t=>t.budgetType==="Income").reduce((a,t)=>a+Math.abs(t.amount),0);
    const tEx = m.filter(t=>t.budgetType==="Expenses").reduce((a,t)=>a+Math.abs(t.amount),0);
    const tSv = m.filter(t=>t.budgetType==="Savings").reduce((a,t)=>a+Math.abs(t.amount),0);
    const tDb = m.filter(t=>t.budgetType==="Debt").reduce((a,t)=>a+Math.abs(t.amount),0);
    return { name: mk.slice(5), Income: tIn, Expenses: tEx, Savings: tSv, Debt: tDb,
      Budget: positions.reduce((a,p)=>a+(p.monthly[i]||0)*(p.section==="Income"?1:-1),0) };
  });

  const rates = trackVsBudget.map(r => ({
    name: r.name,
    rate: r.Income ? ((rateMode==="Expenses"?r.Expenses:rateMode==="Savings"?r.Savings:rateMode==="Debt"?r.Debt:r.Savings+r.Debt) / r.Income) * 100 : 0
  }));

  const accounts = nwPositions.map(n => {
    const txs = inPeriod.filter(t => t.account === n.name);
    const cat = (n.type === "Asset" ? assetCats : liabCats).find(c => c.id === n.categoryId);
    return {
      name: n.name, type: n.type, horizon: cat?.horizon,
      Income: txs.filter(t=>t.budgetType==="Income").reduce((a,t)=>a+t.amount,0),
      Expenses: txs.filter(t=>t.budgetType==="Expenses").reduce((a,t)=>a+t.amount,0),
      SavDebt: txs.filter(t=>t.budgetType==="Savings"||t.budgetType==="Debt").reduce((a,t)=>a+t.amount,0),
      Transfers: txs.filter(t=>t.budgetType==="Transfer").reduce((a,t)=>a+t.amount,0),
      CF: txs.reduce((a,t)=>a+t.amount,0),
      count: txs.length,
      vol: txs.reduce((a,t)=>a+Math.abs(t.amount),0),
      net: txs.reduce((a,t)=>a+t.amount,0),
    };
  }).sort((a,b) => acctSort==="CF" ? b.CF-a.CF : acctSort==="Tx" ? b.count-a.count : acctSort==="Vol" ? b.vol-a.vol : b.net-a.net);

  const Donut = ({ data, title }: { data: { name: string; value: number }[]; title: string }) => (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs font-semibold mb-1">{title}</div>
      {data.length === 0 || data.every(d => d.value === 0) ? (
        <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
              {data.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 11 }}/>
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const allocFor = (sec: BudgetSection) => breakdown(sec).filter(b => b.tracked > 0).map(b => ({ name: b.name, value: b.tracked }));

  return (
    <div className="flex flex-col">
      <PageHeader title="Budget Dashboard" description={`${period} · ${periodFrom}${periodFrom!==periodTo?` → ${periodTo}`:''}`} actions={
        <>
          <ToggleGroup type="single" size="sm" value={detail} onValueChange={v=>v && setDetail(v as any)}>
            <ToggleGroupItem value="Categories">Categories</ToggleGroupItem>
            <ToggleGroupItem value="Positions">Positions</ToggleGroupItem>
          </ToggleGroup>
          <Select value={String(year)} onValueChange={v=>setYear(+v)}><SelectTrigger className="h-8 w-24"><SelectValue/></SelectTrigger><SelectContent>{[2026,2027,2028,2029].map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
          <Select value={period} onValueChange={v=>setPeriod(v as any)}><SelectTrigger className="h-8 w-32"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Year">Total Year</SelectItem><SelectItem value="YTD">YTD</SelectItem><SelectItem value="Month">Month</SelectItem></SelectContent></Select>
          {period === "Month" && <Select value={String(selectedMonth)} onValueChange={v=>setSelectedMonth(+v)}><SelectTrigger className="h-8 w-20"><SelectValue/></SelectTrigger><SelectContent>{Array.from({length:12},(_,i)=>i+1).map(m=><SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent></Select>}
        </>
      }/>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <KpiCard label="Focus" value={`${period} ${year}`}/>
          <KpiCard label="Period Completion" value={`${completion.toFixed(0)}%`}/>
          <KpiCard label="Tracking Balance" value={fmt(balance)} trend={balance>=0?"pos":"neg"}/>
          <KpiCard label="Remaining vs Plan" value={fmt(planExpenses - expenses)}/>
          <KpiCard label="Sav.+Debt Rate" value={`${(sdRate*100).toFixed(1)}%`}/>
          <KpiCard label="Plan Balance" value={fmt(planBalance)}/>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Donut data={allocFor("Income")} title="Income Allocation (Tracked)"/>
          <Donut data={allocFor("Expenses")} title="Expenses Allocation (Tracked)"/>
          <Donut data={allocFor("Savings")} title="Savings Allocation (Tracked)"/>
          <Donut data={allocFor("Debt")} title="Debt Allocation (Tracked)"/>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Tracked vs Budget — {year}</h3>
              <div className="flex gap-3 text-xs">
                {Object.entries(series).map(([k,v]) => (
                  <Label key={k} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={v} onCheckedChange={c => setSeries(s => ({ ...s, [k]: !!c }))} className="h-3.5 w-3.5"/>{k}
                  </Label>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trackVsBudget}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                <XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/>
                <Tooltip contentStyle={{ background:"var(--color-card)", border:"1px solid var(--color-border)", fontSize:11 }}/>
                <Legend wrapperStyle={{fontSize:10}}/>
                {series.Income && <Bar dataKey="Income" fill={COLORS[0]} radius={[3,3,0,0]}/>}
                {series.Expenses && <Bar dataKey="Expenses" fill={COLORS[1]} radius={[3,3,0,0]}/>}
                {series.Savings && <Bar dataKey="Savings" fill={COLORS[2]} radius={[3,3,0,0]}/>}
                {series.Debt && <Bar dataKey="Debt" fill={COLORS[3]} radius={[3,3,0,0]}/>}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Rates vs Income</h3>
              <ToggleGroup type="single" size="sm" value={rateMode} onValueChange={v=>v && setRateMode(v as any)}>
                <ToggleGroupItem value="Expenses">Exp</ToggleGroupItem>
                <ToggleGroupItem value="Savings">Sav</ToggleGroupItem>
                <ToggleGroupItem value="Debt">Debt</ToggleGroupItem>
                <ToggleGroupItem value="Sav.+Debt">S+D</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={rates}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                <XAxis dataKey="name" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} unit="%"/>
                <Tooltip contentStyle={{ background:"var(--color-card)", border:"1px solid var(--color-border)", fontSize:11 }}/>
                <Line dataKey="rate" stroke="var(--color-info)" strokeWidth={2} dot={{r:3}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="text-sm font-semibold">Breakdown — {detail}</h3>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/30"><tr>
              <th className="text-left px-3 py-2 font-medium">Section / {detail.slice(0,-1)}</th>
              <th className="text-right px-3 py-2 font-medium">Tracked</th>
              <th className="text-right px-3 py-2 font-medium">Budget</th>
              <th className="text-right px-3 py-2 font-medium">Compl.</th>
              <th className="text-right px-3 py-2 font-medium">Remaining</th>
              <th className="text-right px-3 py-2 font-medium">Excess</th>
            </tr></thead>
            <tbody>
              {(["Income","Expenses","Savings","Debt"] as BudgetSection[]).map(sec => {
                const items = breakdown(sec);
                const totalT = items.reduce((a,b)=>a+b.tracked,0);
                const totalB = items.reduce((a,b)=>a+b.budget,0);
                return (
                  <>
                    <tr key={sec} className="bg-muted/20 border-t font-semibold">
                      <td className="px-3 py-1.5"><Badge variant="outline">{sec}</Badge></td>
                      <td className="px-3 text-right num">{fmt(totalT)}</td>
                      <td className="px-3 text-right num">{fmt(totalB)}</td>
                      <td className="px-3 text-right num">{totalB ? `${(totalT/totalB*100).toFixed(0)}%` : "—"}</td>
                      <td className="px-3 text-right num">{fmt(Math.max(0,totalB-totalT))}</td>
                      <td className="px-3 text-right num">{fmt(Math.max(0,totalT-totalB))}</td>
                    </tr>
                    {items.map((b,i) => (
                      <tr key={`${sec}-${i}`} className="border-t hover:bg-muted/10">
                        <td className="px-3 py-1 pl-8 text-muted-foreground">{b.name}</td>
                        <td className="px-3 text-right num">{fmt(b.tracked)}</td>
                        <td className="px-3 text-right num">{fmt(b.budget)}</td>
                        <td className="px-3 text-right num">{b.budget ? `${(b.tracked/b.budget*100).toFixed(0)}%` : "—"}</td>
                        <td className="px-3 text-right num">{fmt(Math.max(0,b.budget-b.tracked))}</td>
                        <td className={cn("px-3 text-right num", b.tracked>b.budget && "text-warning")}>{fmt(Math.max(0,b.tracked-b.budget))}</td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="text-sm font-semibold">Account Insights</h3>
            <div className="flex gap-2">
              <Select value={acctView} onValueChange={setAcctView}>
                <SelectTrigger className="h-8 w-44"><SelectValue/></SelectTrigger>
                <SelectContent>{["High-Level","ST Assets (F)","ST Liabil. (F)","LT Assets (F)","LT Liabil. (F)","ST Assets (I)","ST Liabil. (I)","LT Assets (I)","LT Liabil. (I)"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
              <ToggleGroup type="single" size="sm" value={acctSort} onValueChange={v=>v && setAcctSort(v as any)}>
                <ToggleGroupItem value="CF">CF</ToggleGroupItem>
                <ToggleGroupItem value="Tx"># Tx</ToggleGroupItem>
                <ToggleGroupItem value="Vol">Vol</ToggleGroupItem>
                <ToggleGroupItem value="Net">Net</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30"><tr>
                <th className="text-left px-3 py-2 font-medium">Account</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-right px-3 py-2 font-medium">Income</th>
                <th className="text-right px-3 py-2 font-medium">Expenses</th>
                <th className="text-right px-3 py-2 font-medium">Sav+Debt</th>
                <th className="text-right px-3 py-2 font-medium">Transfers</th>
                <th className="text-right px-3 py-2 font-medium">CF Bal</th>
                <th className="text-right px-3 py-2 font-medium"># Tx</th>
                <th className="text-right px-3 py-2 font-medium">Tx Vol</th>
                <th className="text-right px-3 py-2 font-medium">Net Flow</th>
              </tr></thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.name} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-medium">{a.name}</td>
                    <td className="px-3"><Badge variant="outline" className="text-[10px]">{a.horizon} {a.type}</Badge></td>
                    <td className="px-3 text-right num text-pos">{fmt(a.Income)}</td>
                    <td className="px-3 text-right num text-neg">{fmt(a.Expenses)}</td>
                    <td className="px-3 text-right num">{fmt(a.SavDebt)}</td>
                    <td className="px-3 text-right num text-muted-foreground">{fmt(a.Transfers)}</td>
                    <td className={cn("px-3 text-right num font-semibold", a.CF>=0?"text-pos":"text-neg")}>{fmt(a.CF)}</td>
                    <td className="px-3 text-right num">{a.count}</td>
                    <td className="px-3 text-right num">{fmt(a.vol)}</td>
                    <td className={cn("px-3 text-right num", a.net>=0?"text-pos":"text-neg")}>{fmt(a.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
