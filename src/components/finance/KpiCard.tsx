import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
  trend?: "pos" | "neg" | "neutral";
  icon?: LucideIcon;
  className?: string;
}
export function KpiCard({ label, value, hint, delta, trend = "neutral", icon: Icon, className }: Props) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className="num text-2xl font-semibold tracking-tight">{value}</div>
      <div className="flex items-center gap-2 text-xs">
        {delta && <span className={cn("num font-medium", trend === "pos" && "text-pos", trend === "neg" && "text-neg", trend === "neutral" && "text-muted-foreground")}>{delta}</span>}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
