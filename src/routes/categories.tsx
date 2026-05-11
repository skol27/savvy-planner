import { createFileRoute } from "@tanstack/react-router";
import { useFinance, uid } from "@/lib/finance/store";
import { PageHeader } from "@/components/finance/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Check, Search } from "lucide-react";
import { useState } from "react";
import type { BudgetSection } from "@/lib/finance/types";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories — Ledger" }, { name: "description", content: "Manage budget and net worth categories." }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Categories" description="Edit budget and net worth taxonomies."/>
      <div className="p-6">
        <Tabs defaultValue="budget">
          <TabsList>
            <TabsTrigger value="budget">Budget Categories</TabsTrigger>
            <TabsTrigger value="nw">Net Worth Categories</TabsTrigger>
          </TabsList>
          <TabsContent value="budget" className="mt-4"><BudgetCats/></TabsContent>
          <TabsContent value="nw" className="mt-4"><NWCats/></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function BudgetCats() {
  const { budgetCats, setBudgetCats } = useFinance();
  const [q, setQ] = useState("");
  const sections: BudgetSection[] = ["Income","Expenses","Savings","Debt"];
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground"/>
        <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search categories..." className="pl-7 h-8"/>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(sec => {
          const list = budgetCats.filter(c => c.section === sec && c.name.toLowerCase().includes(q.toLowerCase()));
          return (
            <div key={sec} className="rounded-lg border bg-card">
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="text-sm font-semibold">{sec} <span className="text-xs text-muted-foreground font-normal">({list.length})</span></h3>
                <Button size="sm" variant="outline" onClick={() => setBudgetCats(prev => [...prev, { id: uid(), section: sec, name: "New Category" }])}>
                  <Plus className="h-3.5 w-3.5"/>Add
                </Button>
              </div>
              <div className="divide-y">
                {list.map(c => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-1.5">
                    <Input value={c.name} onChange={e => setBudgetCats(prev => prev.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))} className="h-7 text-sm border-0 bg-transparent focus-visible:bg-accent px-2"/>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setBudgetCats(prev => prev.filter(x => x.id !== c.id))}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button>
                  </div>
                ))}
                {list.length === 0 && <div className="px-3 py-6 text-xs text-center text-muted-foreground">No categories</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NWCats() {
  const { assetCats, setAssetCats, liabCats, setLiabCats } = useFinance();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-semibold">Asset Categories</h3>
          <Button size="sm" variant="outline" onClick={() => setAssetCats(p => [...p, { id: uid(), name: "New Asset", horizon: "ST", cash: false, available: false }])}><Plus className="h-3.5 w-3.5"/>Add</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="border-b">
            <th className="text-left px-3 py-2 font-medium">Category</th>
            <th className="text-left px-2 py-2 font-medium">Horizon</th>
            <th className="text-center px-2 py-2 font-medium">Cash</th>
            <th className="text-center px-2 py-2 font-medium">Avail.</th>
            <th></th>
          </tr></thead>
          <tbody>
            {assetCats.map(c => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-1"><Input value={c.name} onChange={e => setAssetCats(p => p.map(x => x.id===c.id ? {...x, name: e.target.value} : x))} className="h-7 border-0 bg-transparent px-2 focus-visible:bg-accent"/></td>
                <td className="px-2"><Badge variant={c.horizon === "ST" ? "secondary" : "default"} onClick={() => setAssetCats(p => p.map(x => x.id===c.id ? {...x, horizon: x.horizon === "ST" ? "LT" : "ST"} : x))} className="cursor-pointer">{c.horizon}</Badge></td>
                <td className="text-center px-2"><Checkbox checked={c.cash} onCheckedChange={v => setAssetCats(p => p.map(x => x.id===c.id ? {...x, cash: !!v} : x))}/></td>
                <td className="text-center px-2"><Checkbox checked={c.available} onCheckedChange={v => setAssetCats(p => p.map(x => x.id===c.id ? {...x, available: !!v} : x))}/></td>
                <td className="px-2"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAssetCats(p => p.filter(x => x.id !== c.id))}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-semibold">Liability Categories</h3>
          <Button size="sm" variant="outline" onClick={() => setLiabCats(p => [...p, { id: uid(), name: "New Liability", horizon: "ST" }])}><Plus className="h-3.5 w-3.5"/>Add</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground"><tr className="border-b">
            <th className="text-left px-3 py-2 font-medium">Category</th>
            <th className="text-left px-2 py-2 font-medium">Horizon</th>
            <th></th>
          </tr></thead>
          <tbody>
            {liabCats.map(c => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-1"><Input value={c.name} onChange={e => setLiabCats(p => p.map(x => x.id===c.id ? {...x, name: e.target.value} : x))} className="h-7 border-0 bg-transparent px-2 focus-visible:bg-accent"/></td>
                <td className="px-2"><Badge variant={c.horizon === "ST" ? "secondary" : "default"} onClick={() => setLiabCats(p => p.map(x => x.id===c.id ? {...x, horizon: x.horizon === "ST" ? "LT" : "ST"} : x))} className="cursor-pointer">{c.horizon}</Badge></td>
                <td className="px-2"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLiabCats(p => p.filter(x => x.id !== c.id))}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
