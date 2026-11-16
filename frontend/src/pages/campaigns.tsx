import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  CircleDollarSign,
  ExternalLink,
  Layers,
  MousePointerClick,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";

import { api, ApiError, type CampaignSummary, type StatMetrics } from "@/lib/api";
import {
  formatMoney,
  formatNumber,
  formatPercent,
  INTERVALS,
  intervalLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";

function hostOf(value: string | null): string {
  if (!value) return "—";
  try {
    return new URL(value).hostname;
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export function CampaignsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [interval, setIntervalValue] = React.useState("today");

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const metaQuery = useQuery({
    queryKey: ["meta"],
    queryFn: () => api.meta(),
    staleTime: 60_000,
    retry: 1,
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", debouncedSearch, interval],
    queryFn: () => api.campaigns(debouncedSearch, interval),
    placeholderData: (previous) => previous,
  });

  const countries = React.useMemo(
    () => new Map((metaQuery.data?.countries ?? []).map((country) => [country.code, country])),
    [metaQuery.data],
  );

  const items = campaignsQuery.data?.items ?? [];
  const totals: StatMetrics =
    campaignsQuery.data?.totals ?? {
      clicks: 0,
      conversions: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      roi: 0,
      cr: 0,
      epc: 0,
    };
  const activeCount = items.filter((item) => item.state === "active").length;
  const connectionIssue =
    metaQuery.data && !metaQuery.data.connection_ok ? metaQuery.data.connection_error : null;
  const errorMessage = campaignsQuery.error instanceof ApiError ? campaignsQuery.error.message : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Keitaro workspace"
        title="Кампании"
        description="Единый список кампаний трекера. Создавайте новые связки и редактируйте офферы в потоках без переключения на тяжёлую админку Keitaro."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void metaQuery.refetch();
                void campaignsQuery.refetch();
              }}
              disabled={campaignsQuery.isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", campaignsQuery.isFetching && "animate-spin")} />
              Обновить
            </Button>
            <Button asChild size="sm">
              <Link to="/campaigns/new">
                <Plus className="h-4 w-4" />
                Создать кампанию
              </Link>
            </Button>
          </>
        }
      />

      {(connectionIssue || errorMessage) && (
        <Alert variant="warning" className="mb-5">
          <Target className="h-4 w-4" />
          <AlertTitle>Не удалось получить данные из Keitaro</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{connectionIssue || errorMessage}</p>
            <p>
              Проверьте `KEITARO_BASE_URL` и `KEITARO_API_KEY` в `.env`, затем обновите страницу.{" "}
              <Link to="/settings" className="font-semibold underline underline-offset-2">
                Открыть настройки
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Кампаний доступно"
          value={formatNumber(items.length)}
          hint={`${activeCount} активных`}
          icon={Layers}
        />
        <StatCard
          label={`Клики · ${intervalLabel(interval).toLowerCase()}`}
          value={formatNumber(totals.clicks)}
          hint={`${formatNumber(totals.conversions)} конверсий`}
          icon={MousePointerClick}
        />
        <StatCard
          label="Профит"
          value={formatMoney(totals.profit)}
          hint={`Выручка ${formatMoney(totals.revenue)}`}
          icon={CircleDollarSign}
          tone={totals.profit > 0 ? "positive" : totals.profit < 0 ? "negative" : "default"}
        />
        <StatCard
          label="ROI"
          value={formatPercent(totals.roi)}
          hint={`CR ${formatPercent(totals.cr)}`}
          icon={Percent}
          tone={totals.roi > 0 ? "positive" : totals.roi < 0 ? "negative" : "default"}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по названию, ID или alias…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:block">Период:</span>
            <Select value={interval} onValueChange={setIntervalValue}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVALS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {campaignsQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="ml-auto h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={debouncedSearch ? "Ничего не найдено" : "Пока нет кампаний"}
            description={
              debouncedSearch
                ? "Попробуйте изменить запрос или сбросить фильтр."
                : "Создайте первую кампанию: мы настроим домен, группу, источник и два потока автоматически."
            }
            action={
              debouncedSearch ? (
                <Button variant="outline" onClick={() => setSearch("")}>
                  Сбросить поиск
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/campaigns/new">
                    <Plus className="h-4 w-4" />
                    Создать кампанию
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="min-w-[260px]">Кампания</TableHead>
                <TableHead>Гео</TableHead>
                <TableHead>Группа / источник</TableHead>
                <TableHead>Домен</TableHead>
                <TableHead className="text-right">Клики</TableHead>
                <TableHead className="text-right">Конв.</TableHead>
                <TableHead className="text-right">Профит</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((campaign: CampaignSummary) => (
                <TableRow
                  key={campaign.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="max-w-[320px] truncate font-semibold" title={campaign.name}>
                            {campaign.name}
                          </span>
                          <Badge
                            variant={campaign.state === "active" ? "success" : "muted"}
                            className="shrink-0 px-1.5 py-0 text-[10px]"
                          >
                            {campaign.state === "active" ? "active" : campaign.state}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">#{campaign.id}</span>
                          <span className="max-w-[280px] truncate font-mono opacity-70" title={campaign.alias}>
                            {campaign.alias}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {campaign.geo.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {campaign.geo.slice(0, 4).map((code) => {
                          const country = countries.get(code);
                          return (
                            <Badge key={code} variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                              <span>{country?.flag ?? "🌍"}</span>
                              {code}
                            </Badge>
                          );
                        })}
                        {campaign.geo.length > 4 && (
                          <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
                            +{campaign.geo.length - 4}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-[13px] font-medium">{campaign.group || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {campaign.traffic_source || "Источник не указан"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[13px]">{hostOf(campaign.domain)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      потоков: {campaign.streams_count || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(campaign.clicks)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(campaign.conversions)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        campaign.profit > 0 && "text-emerald-600",
                        campaign.profit < 0 && "text-red-600",
                      )}
                    >
                      {formatMoney(campaign.profit, campaign.currency)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium tabular-nums",
                        campaign.roi > 0
                          ? "text-emerald-600"
                          : campaign.roi < 0
                            ? "text-red-600"
                            : "text-muted-foreground",
                      )}
                    >
                      {campaign.roi > 0 && <TrendingUp className="h-3 w-3" />}
                      {formatPercent(campaign.roi)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Редактор офферов"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/campaigns/${campaign.id}`);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {campaign.admin_url && (
                        <Button
                          asChild
                          variant="ghost"
                          size="icon-sm"
                          title="Открыть в Keitaro"
                        >
                          <a
                            href={campaign.admin_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground">
            <span>
              Показано {items.length} из {campaignsQuery.data?.total ?? items.length}
            </span>
            <span className="flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
              Нажмите на строку, чтобы открыть редактор
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
