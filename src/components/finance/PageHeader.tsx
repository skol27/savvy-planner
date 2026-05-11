import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, className }: { title: string; description?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/80 backdrop-blur px-6 py-3", className)}>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
