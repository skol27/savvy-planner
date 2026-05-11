import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/finance/PageHeader";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help — Ledger" }, { name: "description", content: "How budget planning, transactions, net worth tracking, and projections work." }] }),
  component: HelpPage,
});
const sections = [
  { t: "Budget Planning", b: "Define monthly amounts per income, expense, savings, and debt position. The annual total feeds dashboards. 'To be allocated' = Income − Expenses − Savings − Debt." },
  { t: "Creating budget positions", b: "On the Budget Planner, click 'Position' inside a section. Each position belongs to one category, and dropdowns are restricted to that section's categories." },
  { t: "Net Worth Tracking", b: "Each asset/liability has a monthly balance. Per-month status: Empty, Tracked, or Latest. Net worth = Σ Assets − Σ Liabilities." },
  { t: "Creating assets and liabilities", b: "On the Net Worth Tracker, click 'Asset' or 'Liability'. Pick a category whose horizon (ST/LT) decides where it appears in dashboards." },
  { t: "Transaction signs", b: "Positive amounts are inflows, negatives are outflows. Income tx are typically positive; expense tx negative; transfers are paired (out from one account, in to another)." },
  { t: "One-sided transactions", b: "An income or expense affects exactly one account and one budget position. No counter-leg required." },
  { t: "Two-sided transfers", b: "Transfers and savings/debt movements come in pairs (one negative on the source account, one positive on the destination). They are net-zero for net worth." },
  { t: "Late income shifting", b: "If enabled in Settings, any Income transaction on or after the configured day is moved to the next month for budget reporting (raw date is preserved)." },
  { t: "Lazy vs Strict latest tracked month", b: "Lazy: the latest month with any data. Strict: the latest month where every prior month also has data — guarantees continuity." },
  { t: "IRR / ECR", b: "Internal Rate of Return for assets and Effective Cost Rate for liabilities. Computed from start value, end value, and contributions over the selected period." },
  { t: "Projections", b: "Take latest net worth and roll forward year-by-year. Income grows by income growth %, expenses by inflation %. Extra cash flows (PV or nominal) layer in. From retirement year, retirement income replaces working income." },
];
function HelpPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Help / Workbook Notes" description="A quick reference for how the model works."/>
      <div className="p-6 max-w-3xl">
        <div className="rounded-lg border bg-card divide-y">
          {sections.map((s,i) => (
            <div key={i} className="p-4">
              <h3 className="text-sm font-semibold">{s.t}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.b}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
