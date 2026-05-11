import { createFileRoute, Link } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance/store";
import {
  budgetMonthValue,
  fmt,
  latestTrackedMonth,
  nwTotals,
  monthKey,
  projectNetWorth,
} from "@/lib/finance/calc";
import { KpiCard } from "@/components/finance/KpiCard";
import { PageHeader } from "@/components/finance/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Coins,
  TrendingUp,
  Calendar,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Ledger" },
      {
        name: "description",
        content: "Snapshot of your money: net worth, budget tracking, and projections.",
      },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { nwPositions, transactions, settings, positions, projection, extras } = useFinance();
  const latest = latestTrackedMonth(nwPositions, settings.latestTrackedMode) || "2026-02";
  const totals = nwTotals(nwPositions, latest);
  const months = [...new Set(nwPositions.flatMap((p) => Object.keys(p.balances)))].sort();
  const series = months.map((m) => {
    const t = nwTotals(nwPositions, m);
    return { month: m.slice(2), assets: t.assets, liab: -t.liab, net: t.net };
  });
  const txMonth = transactions.filter((t) => monthKey(t.date) === latest);
  const income = txMonth
    .filter((t) => t.budgetType === "Income")
    .reduce((a, t) => a + Math.abs(t.amount), 0);
  const expenses = txMonth
    .filter((t) => t.budgetType === "Expenses")
    .reduce((a, t) => a + Math.abs(t.amount), 0);
  const savings = txMonth
    .filter((t) => t.budgetType === "Savings")
    .reduce((a, t) => a + Math.abs(t.amount), 0);
  const debt = txMonth
    .filter((t) => t.budgetType === "Debt")
    .reduce((a, t) => a + Math.abs(t.amount), 0);
  const sdRate = income ? (savings + debt) / income : 0;
  const proj = projectNetWorth(projection, totals.net, extras, new Date().getFullYear());
  const projEnd = proj[proj.length - 1]?.nw || 0;
  const budgetVsPlan = [
    {
      name: "Income",
      actual: income,
      plan: positions
        .filter((p) => p.section === "Income")
        .reduce(
          (a, p) => a + budgetMonthValue(p, settings, +latest.slice(0, 4), +latest.slice(5, 7)),
          0,
        ),
    },
    {
      name: "Expenses",
      actual: expenses,
      plan: positions
        .filter((p) => p.section === "Expenses")
        .reduce(
          (a, p) => a + budgetMonthValue(p, settings, +latest.slice(0, 4), +latest.slice(5, 7)),
          0,
        ),
    },
    {
      name: "Savings",
      actual: savings,
      plan: positions
        .filter((p) => p.section === "Savings")
        .reduce(
          (a, p) => a + budgetMonthValue(p, settings, +latest.slice(0, 4), +latest.slice(5, 7)),
          0,
        ),
    },
    {
      name: "Debt",
      actual: debt,
      plan: positions
        .filter((p) => p.section === "Debt")
        .reduce(
          (a, p) => a + budgetMonthValue(p, settings, +latest.slice(0, 4), +latest.slice(5, 7)),
          0,
        ),
    },
  ];
  const flowSummary = [
    { name: "Income", value: income, color: "var(--color-pos)" },
    { name: "Expenses", value: expenses, color: "var(--color-neg)" },
    { name: "Savings", value: savings, color: "var(--color-info)" },
    { name: "Debt", value: debt, color: "var(--color-warning)" },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Overview"
        description={`Snapshot for ${latest}`}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/transactions">
                <Plus className="h-3.5 w-3.5" />
                Tx
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/budget">
                <Plus className="h-3.5 w-3.5" />
                Position
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/networth">
                <Plus className="h-3.5 w-3.5" />
                Account
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/projection">
                <Plus className="h-3.5 w-3.5" />
                Cash flow
              </Link>
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Net Worth" value={fmt(totals.net)} icon={Coins} delta={`${latest}`} />
          <KpiCard
            label="Total Assets"
            value={fmt(totals.assets)}
            trend="pos"
            icon={ArrowUpRight}
          />
          <KpiCard
            label="Total Liabilities"
            value={fmt(totals.liab)}
            trend="neg"
            icon={ArrowDownRight}
          />
          <KpiCard label="Monthly Income" value={fmt(income)} trend="pos" icon={Wallet} />
          <KpiCard label="Monthly Expenses" value={fmt(expenses)} trend="neg" icon={Wallet} />
          <KpiCard
            label="Sav.+Debt Rate"
            value={`${(sdRate * 100).toFixed(1)}%`}
            icon={TrendingUp}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Budget Tracking Bal."
            value={fmt(income - expenses - savings - debt)}
            hint="Period to date"
          />
          <KpiCard
            label="Latest Tracked"
            value={latest}
            icon={Calendar}
            hint={settings.latestTrackedMode}
          />
          <KpiCard
            label="Projection End NW"
            value={fmt(projEnd)}
            hint={`@${projection.endYear} ${projection.outputMode === "InflAdj" ? "(adj.)" : ""}`}
          />
          <KpiCard label="Tracked months" value={months.length} hint="Net worth history" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Net Worth Trend</h3>
              <Link to="/networth-dashboard" className="text-xs text-info hover:underline">
                Open dashboard →
              </Link>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="nwgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-info)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  stroke="var(--color-muted-foreground)"
                />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="var(--color-info)"
                  fill="url(#nwgrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Cash Flow Summary</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={flowSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {flowSummary.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Budget — Actual vs Plan ({latest})</h3>
            <Link to="/budget-dashboard" className="text-xs text-info hover:underline">
              Open dashboard →
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={budgetVsPlan}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="plan"
                fill="var(--color-muted-foreground)"
                radius={[4, 4, 0, 0]}
                name="Plan"
              />
              <Bar dataKey="actual" fill="var(--color-info)" radius={[4, 4, 0, 0]} name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
