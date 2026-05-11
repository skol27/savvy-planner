import { createFileRoute } from "@tanstack/react-router";
import { useFinance, uid } from "@/lib/finance/store";
import { PageHeader } from "@/components/finance/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertTriangle, Pencil, Check } from "lucide-react";
import { useState } from "react";
import {
  budgetMonthIndex,
  budgetYearTotal,
  fmt,
  sectionTotal as calcSectionTotal,
} from "@/lib/finance/calc";
import type { BudgetPosition, BudgetSection } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Budget Planner — Ledger" },
      {
        name: "description",
        content: "Plan monthly budget positions across income, expenses, savings, and debt.",
      },
    ],
  }),
  component: BudgetPage,
});

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type BudgetView = "Monthly" | "Annual" | "Horizon";
const sectionColor: Record<BudgetSection, string> = {
  Income: "text-pos",
  Expenses: "text-neg",
  Savings: "text-info",
  Debt: "text-warning",
};

function BudgetPage() {
  const { positions, setPositions, budgetCats, settings } = useFinance();
  const [year, setYear] = useState(settings.startingYear);
  const [view, setView] = useState<BudgetView>("Monthly");
  const [edit, setEdit] = useState(false);
  const sections: BudgetSection[] = ["Income", "Expenses", "Savings", "Debt"];
  const years = Array.from({ length: 10 }, (_, i) => settings.startingYear + i);
  const monthIndex = (m: number) => budgetMonthIndex(settings, year, m + 1);
  const yearTotal = (p: BudgetPosition) => budgetYearTotal(p, settings, year);
  const horizonTotal = (p: { monthly: number[] }) => p.monthly.reduce((a, b) => a + b, 0);
  const sectionTotal = (sec: BudgetSection) => calcSectionTotal(positions, sec, settings, year);
  const sectionHorizonTotal = (sec: BudgetSection) =>
    positions.filter((p) => p.section === sec).reduce((a, p) => a + horizonTotal(p), 0);
  const monthlySectionTotal = (sec: BudgetSection, month: number) =>
    positions
      .filter((p) => p.section === sec)
      .reduce((a, p) => a + (p.monthly[monthIndex(month)] || 0), 0);
  const incomeExpenseDiff = M.map(
    (_, i) => monthlySectionTotal("Income", i) - monthlySectionTotal("Expenses", i),
  );
  const allocated =
    sectionTotal("Income") -
    sectionTotal("Expenses") -
    sectionTotal("Savings") -
    sectionTotal("Debt");
  const monthlyAllocated = allocated / 12;

  const addPosition = (sec: BudgetSection) => {
    const cat = budgetCats.find((c) => c.section === sec);
    if (!cat) return;
    setPositions((prev) => [
      ...prev,
      {
        id: uid(),
        section: sec,
        categoryId: cat.id,
        name: "New Position",
        monthly: Array(120).fill(0),
      },
    ]);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Budget Planner"
        description={`Plan ${year} across all categories`}
        actions={
          <>
            <Button
              size="sm"
              variant={edit ? "default" : "outline"}
              onClick={() => setEdit((e) => !e)}
            >
              {edit ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Done
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </>
              )}
            </Button>
            <ToggleGroup
              type="single"
              size="sm"
              value={view}
              onValueChange={(v) => v && setView(v as BudgetView)}
            >
              <ToggleGroupItem value="Monthly">Monthly</ToggleGroupItem>
              <ToggleGroupItem value="Annual">Annual</ToggleGroupItem>
              <ToggleGroupItem value="Horizon">10-Year</ToggleGroupItem>
            </ToggleGroup>
            <Select value={String(year)} onValueChange={(v) => setYear(+v)}>
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => settings.startingYear + i).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <div className="p-6 space-y-4">
        <div
          className={cn(
            "rounded-lg border p-4 flex items-center justify-between",
            monthlyAllocated < 0 ? "border-destructive bg-destructive/5" : "bg-card",
          )}
        >
          <div className="flex items-center gap-3">
            {monthlyAllocated < 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                To be allocated (monthly avg)
              </div>
              <div
                className={cn(
                  "num text-2xl font-semibold",
                  monthlyAllocated < 0 ? "text-destructive" : "text-pos",
                )}
              >
                {fmt(monthlyAllocated, 0)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-6 text-xs">
            {sections.map((s) => (
              <div key={s}>
                <div className="text-muted-foreground">{s}/yr</div>
                <div className={cn("num font-semibold", sectionColor[s])}>
                  {fmt(sectionTotal(s))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {sections.map((sec) => {
          const rows = positions.filter((p) => p.section === sec);
          const annualSec = rows.reduce((a, r) => a + r.monthly.reduce((x, y) => x + y, 0), 0);
          const selectedYearSec = rows.reduce((a, r) => a + yearTotal(r), 0);
          const cats = budgetCats.filter((c) => c.section === sec);
          return (
            <div key={sec} className="rounded-lg border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("font-semibold", sectionColor[sec])}>
                    {sec}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {rows.length} positions • {year} {fmt(selectedYearSec)}
                    {view === "Horizon" ? ` • 10-year ${fmt(annualSec)}` : ""}
                  </span>
                </div>
                {edit && (
                  <Button size="sm" variant="outline" onClick={() => addPosition(sec)}>
                    <Plus className="h-3.5 w-3.5" />
                    Position
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium w-40">Category</th>
                      <th className="text-left px-2 py-1.5 font-medium w-44">Position</th>
                      {view === "Monthly" &&
                        M.map((m) => (
                          <th key={m} className="text-right px-1 py-1.5 font-medium w-16">
                            {m}
                          </th>
                        ))}
                      {view === "Horizon" &&
                        years.map((y) => (
                          <th key={y} className="text-right px-2 py-1.5 font-medium w-20">
                            {y}
                          </th>
                        ))}
                      <th className="text-right px-2 py-1.5 font-medium">
                        {view === "Horizon" ? "10-Year" : "Annual"}
                      </th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const cat = budgetCats.find((c) => c.id === p.categoryId);
                      const matches = cat?.section === sec;
                      const annual = view === "Horizon" ? horizonTotal(p) : yearTotal(p);
                      const selectedYearValues = M.map((_, i) => p.monthly[monthIndex(i)] || 0);
                      return (
                        <tr key={p.id} className="border-t hover:bg-muted/20">
                          <td className="px-2 py-1">
                            {edit ? (
                              <Select
                                value={p.categoryId}
                                onValueChange={(v) =>
                                  setPositions((prev) =>
                                    prev.map((x) => (x.id === p.id ? { ...x, categoryId: v } : x)),
                                  )
                                }
                              >
                                <SelectTrigger
                                  className={cn("h-7 text-xs", !matches && "border-destructive")}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {cats.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs">{cat?.name ?? "—"}</span>
                            )}
                            {!matches && (
                              <div className="text-[10px] text-destructive mt-0.5">
                                Wrong section
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1">
                            {edit ? (
                              <Input
                                value={p.name}
                                onChange={(e) =>
                                  setPositions((prev) =>
                                    prev.map((x) =>
                                      x.id === p.id ? { ...x, name: e.target.value } : x,
                                    ),
                                  )
                                }
                                className="h-7 text-xs"
                              />
                            ) : (
                              <span className="text-xs">{p.name}</span>
                            )}
                          </td>
                          {view === "Monthly" &&
                            selectedYearValues.map((v, i) => (
                              <td key={i} className="px-1 py-1">
                                {edit ? (
                                  <Input
                                    type="number"
                                    value={v}
                                    onChange={(e) =>
                                      setPositions((prev) =>
                                        prev.map((x) =>
                                          x.id === p.id
                                            ? {
                                                ...x,
                                                monthly: x.monthly.map((mv, mi) =>
                                                  mi === monthIndex(i) ? +e.target.value : mv,
                                                ),
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                    className="h-7 text-xs num text-right px-1"
                                  />
                                ) : (
                                  <div
                                    className={cn("text-xs num text-right px-1", sectionColor[sec])}
                                  >
                                    {fmt(v, 0)}
                                  </div>
                                )}
                              </td>
                            ))}
                          {view === "Horizon" &&
                            years.map((y) => (
                              <td
                                key={y}
                                className={cn("px-2 py-1 text-right num", sectionColor[sec])}
                              >
                                {fmt(budgetYearTotal(p, settings, y), 0)}
                              </td>
                            ))}
                          <td
                            className={cn(
                              "px-2 py-1 text-right num font-semibold",
                              sectionColor[sec],
                            )}
                          >
                            {fmt(annual)}
                          </td>
                          <td>
                            {edit && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() =>
                                  setPositions((prev) => prev.filter((x) => x.id !== p.id))
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={20} className="text-center py-6 text-muted-foreground">
                          No positions. Click "Position" to add one.
                        </td>
                      </tr>
                    )}
                    {view === "Monthly" ? (
                      <tr className="border-t bg-muted/20 font-semibold">
                        <td colSpan={2} className="px-2 py-1.5 text-right">
                          Monthly Total:
                        </td>
                        {M.map((_, i) => (
                          <td
                            key={i}
                            className={cn("px-1 py-1.5 text-right num", sectionColor[sec])}
                          >
                            {fmt(monthlySectionTotal(sec, i), 0)}
                          </td>
                        ))}
                        <td className={cn("px-2 py-1.5 text-right num", sectionColor[sec])}>
                          {fmt(selectedYearSec)}
                        </td>
                        <td></td>
                      </tr>
                    ) : (
                      <tr className="border-t bg-muted/20 font-semibold">
                        <td
                          colSpan={view === "Horizon" ? 12 : 2}
                          className="px-2 py-1.5 text-right"
                        >
                          Section Total:
                        </td>
                        <td className={cn("px-2 py-1.5 text-right num", sectionColor[sec])}>
                          {fmt(view === "Horizon" ? sectionHorizonTotal(sec) : selectedYearSec)}
                        </td>
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {view === "Monthly" && (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="p-3 border-b bg-muted/30">
              <h3 className="text-sm font-semibold">Income vs Expenses</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium w-44">Metric</th>
                    {M.map((m) => (
                      <th key={m} className="text-right px-1 py-1.5 font-medium w-16">
                        {m}
                      </th>
                    ))}
                    <th className="text-right px-2 py-1.5 font-medium">Annual</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-2 py-1.5 font-medium text-pos">Income</td>
                    {M.map((_, i) => (
                      <td key={i} className="px-1 py-1.5 text-right num text-pos">
                        {fmt(monthlySectionTotal("Income", i), 0)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right num text-pos">
                      {fmt(sectionTotal("Income"))}
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-2 py-1.5 font-medium text-neg">Expenses</td>
                    {M.map((_, i) => (
                      <td key={i} className="px-1 py-1.5 text-right num text-neg">
                        {fmt(monthlySectionTotal("Expenses", i), 0)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right num text-neg">
                      {fmt(sectionTotal("Expenses"))}
                    </td>
                  </tr>
                  <tr className="border-t bg-muted/20 font-semibold">
                    <td className="px-2 py-1.5">Difference</td>
                    {incomeExpenseDiff.map((v, i) => (
                      <td
                        key={i}
                        className={cn(
                          "px-1 py-1.5 text-right num",
                          v >= 0 ? "text-pos" : "text-neg",
                        )}
                      >
                        {fmt(v, 0)}
                      </td>
                    ))}
                    <td
                      className={cn(
                        "px-2 py-1.5 text-right num",
                        sectionTotal("Income") - sectionTotal("Expenses") >= 0
                          ? "text-pos"
                          : "text-neg",
                      )}
                    >
                      {fmt(sectionTotal("Income") - sectionTotal("Expenses"))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
