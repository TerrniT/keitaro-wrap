import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "positive" | "negative" | "muted";
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default", className }: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>
          <div
            className={cn(
              "mt-1.5 truncate text-2xl font-bold tracking-tight",
              tone === "positive" && "text-emerald-600",
              tone === "negative" && "text-red-600",
              tone === "muted" && "text-muted-foreground",
            )}
          >
            {value}
          </div>
          {hint && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </Card>
  );
}
