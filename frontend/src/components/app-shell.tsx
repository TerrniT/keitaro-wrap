import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  PlusCircle,
  Settings,
  Sparkles,
} from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const navigation = [
  { to: "/", label: "Кампании", icon: LayoutDashboard, end: true },
  { to: "/campaigns/new", label: "Создать кампанию", icon: PlusCircle },
  { to: "/settings", label: "Настройки", icon: Settings },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground shadow-lg shadow-primary/20">
        K
      </div>
      <div className="leading-tight">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold tracking-tight text-white">Keitaro Wrapper</span>
          <Badge className="border-0 bg-white/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-white/70">
            beta
          </Badge>
        </div>
        <div className="text-[11px] text-white/45">campaign &amp; offer manager</div>
      </div>
    </div>
  );
}

function ConnectionBadge() {
  const { data, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/50">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white/40" />
        Проверяем Keitaro…
      </div>
    );
  }

  const ok = data?.keitaro_connected;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        ok
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-red-400/20 bg-red-400/10 text-red-200",
      )}
      title={data?.keitaro_error ?? undefined}
    >
      <span className={cn("h-2 w-2 rounded-full", ok ? "bg-emerald-400" : "bg-red-400")} />
      <span className="truncate">{ok ? "Keitaro подключён" : "Keitaro недоступен"}</span>
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const isEditor = /^\/campaigns\/\d+/.test(location.pathname);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-5 pb-6 pt-6">
          <Logo />
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navigation.map((item) => {
            const itemActive =
              item.to === "/"
                ? location.pathname === "/" || /^\/campaigns\/\d+/.test(location.pathname)
                : item.to === "/campaigns/new"
                  ? location.pathname === "/campaigns/new"
                  : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/65 transition-colors",
                  "hover:bg-white/[0.06] hover:text-white",
                  itemActive && "bg-white/[0.09] text-white shadow-sm",
                )}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] transition-colors",
                    itemActive ? "text-primary" : "text-white/40 group-hover:text-white/70",
                  )}
                />
                <span>{item.label}</span>
                {itemActive && <ChevronRight className="ml-auto h-3.5 w-3.5 text-white/30" />}
              </NavLink>
            );
          })}
        </nav>

        <div className="space-y-3 px-4 pb-5">
          <ConnectionBadge />
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Подсказка
            </div>
            <p className="text-[11px] leading-relaxed text-white/40">
              Изменения офферов сохраняются в Keitaro только после нажатия
              «Сохранить в Keitaro».
            </p>
          </div>
          <a
            href="https://docs.keitaro.io/en/development/admin-api.html"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-1 text-[11px] text-white/35 transition-colors hover:text-white/70"
          >
            <CircleHelp className="h-3.5 w-3.5" />
            Keitaro Admin API docs
          </a>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/10 bg-sidebar px-4 py-3 text-white lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          {navigation.map((item) => (
            <Button
              key={item.to}
              asChild
              variant="ghost"
              size="icon-sm"
              className="text-white/70 hover:bg-white/10 hover:text-white"
            >
              <NavLink to={item.to} end={item.end} aria-label={item.label}>
                <item.icon className="h-4 w-4" />
              </NavLink>
            </Button>
          ))}
        </div>
      </header>

      <main className={cn("min-h-screen lg:pl-[260px]", isEditor && "bg-[#f4f7f4]")}>
        <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
        <footer className="mx-auto flex w-full max-w-[1500px] items-center justify-between px-4 pb-6 text-[11px] text-muted-foreground sm:px-6 lg:px-8">
          <span>Keitaro Wrapper · FastAPI + React</span>
          <span className="flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            данные из Keitaro
          </span>
        </footer>
      </main>
    </div>
  );
}
