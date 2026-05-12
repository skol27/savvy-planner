import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance/store";
import { backupFileName, parseBackup, type FinanceBackup } from "@/lib/finance/persistence";
import { PageHeader } from "@/components/finance/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, HardDrive, Info, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Settings } from "@/lib/finance/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ledger" },
      {
        name: "description",
        content:
          "Configure planning horizon, late income shifting, tracking mode, and IRR/ECR calculations.",
      },
    ],
  }),
  component: SettingsPage,
});

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function SettingsPage() {
  const {
    settings,
    setSettings,
    exportBackup,
    importState,
    persistenceStatus,
    persistenceMessage,
  } = useFinance();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<FinanceBackup | null>(null);
  const set = (patch: Partial<typeof settings>) => setSettings({ ...settings, ...patch });
  const yearValid = settings.startingYear >= 1900 && settings.startingYear <= 3000;
  const monthValid = settings.startingMonth >= 1 && settings.startingMonth <= 12;
  const dayValid = settings.lateIncomeDay >= 1 && settings.lateIncomeDay <= 31;
  const firstMonthLabel =
    monthValid && yearValid
      ? `${monthNames[settings.startingMonth - 1]} ${settings.startingYear}`
      : "Invalid";

  const downloadBackup = () => {
    const backup = exportBackup();
    const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName();
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exported.");
  };

  const readImportFile = async (file: File) => {
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      if (!backup) {
        toast.error("This file is not a valid Savvy Planner backup.");
        return;
      }
      setPendingBackup(backup);
    } catch {
      toast.error("Could not read that backup file.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const confirmImport = () => {
    if (!pendingBackup) return;
    importState(pendingBackup.state);
    setPendingBackup(null);
    toast.success("Backup imported.");
  };

  const statusVariant =
    persistenceStatus === "file"
      ? "default"
      : persistenceStatus === "saving"
        ? "secondary"
        : "outline";

  return (
    <div className="flex flex-col">
      <PageHeader title="Settings" description="Global app configuration." />
      <div className="p-6 max-w-3xl space-y-6">
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">Data Backup</h2>
              <p className="text-xs text-muted-foreground">
                Export, import, and local file persistence for finance data.
              </p>
            </div>
            <Badge variant={statusVariant} className="gap-1 whitespace-nowrap">
              <HardDrive className="h-3.5 w-3.5" />
              {persistenceStatus === "file"
                ? "File saved"
                : persistenceStatus === "saving"
                  ? "Saving"
                  : "Browser fallback"}
            </Badge>
          </div>
          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {persistenceMessage}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={downloadBackup}>
              <Download className="h-3.5 w-3.5" />
              Export Backup
            </Button>
            <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Import Backup
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readImportFile(file);
              }}
            />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">General</h2>
            <p className="text-xs text-muted-foreground">
              Defines the planning horizon used everywhere.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Starting Year</Label>
              <Input
                type="number"
                value={settings.startingYear}
                onChange={(e) => set({ startingYear: +e.target.value })}
                className={!yearValid ? "border-destructive" : ""}
              />
              {!yearValid && <p className="text-xs text-destructive">Year must be 1900–3000.</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Starting Month</Label>
              <Select
                value={String(settings.startingMonth)}
                onValueChange={(v) => set({ startingMonth: +v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((n, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2 text-xs flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-info" /> First tracked month:{" "}
            <span className="font-medium">{firstMonthLabel}</span>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Budget Tracking</h2>
            <p className="text-xs text-muted-foreground">
              Late income shifting moves income transactions on or after the configured day to the
              next month.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Shift late income</Label>
              <p className="text-xs text-muted-foreground">
                {settings.shiftLateIncome ? "Active" : "Inactive"}
              </p>
            </div>
            <Switch
              checked={settings.shiftLateIncome}
              onCheckedChange={(v) => set({ shiftLateIncome: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Starting day</Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={settings.lateIncomeDay}
              onChange={(e) => set({ lateIncomeDay: +e.target.value })}
              disabled={!settings.shiftLateIncome}
              className={!dayValid ? "border-destructive" : ""}
            />
            {!dayValid && <p className="text-xs text-destructive">Day must be 1–31.</p>}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Net Worth Tracking</h2>
            <p className="text-xs text-muted-foreground">
              How "Latest Tracked Month" is determined.
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={settings.latestTrackedMode}
            onValueChange={(v) =>
              v && set({ latestTrackedMode: v as Settings["latestTrackedMode"] })
            }
            className="justify-start"
          >
            <ToggleGroupItem
              value="Lazy"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Lazy
            </ToggleGroupItem>
            <ToggleGroupItem
              value="Strict"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Strict
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border p-3">
              <b>Lazy</b> — Latest month with data in any single position.
            </div>
            <div className="rounded-md border p-3">
              <b>Strict</b> — Latest month where every prior month has data too.
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Performance — IRR / ECR</h2>
              <p className="text-xs text-muted-foreground">
                Calculate per-position internal rate of return / cost ratio.
              </p>
            </div>
            <Switch checked={settings.irrEcr} onCheckedChange={(v) => set({ irrEcr: v })} />
          </div>
          {settings.irrEcr && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Enabling IRR/ECR can be computationally expensive on large datasets.
              </AlertDescription>
            </Alert>
          )}
        </section>
      </div>

      <Dialog open={!!pendingBackup} onOpenChange={(open) => !open && setPendingBackup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Backup</DialogTitle>
          </DialogHeader>
          {pendingBackup && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Importing this backup will replace the current finance data in the app.
              </p>
              <div className="rounded-md border text-xs">
                <div className="flex justify-between border-b px-3 py-2">
                  <span className="text-muted-foreground">Exported</span>
                  <span className="num">{new Date(pendingBackup.exportedAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b px-3 py-2">
                  <span className="text-muted-foreground">Transactions</span>
                  <span className="num">{pendingBackup.state.transactions.length}</span>
                </div>
                <div className="flex justify-between border-b px-3 py-2">
                  <span className="text-muted-foreground">Budget positions</span>
                  <span className="num">{pendingBackup.state.positions.length}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground">Net worth positions</span>
                  <span className="num">{pendingBackup.state.nwPositions.length}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingBackup(null)}>
              Cancel
            </Button>
            <Button onClick={confirmImport}>Replace Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
