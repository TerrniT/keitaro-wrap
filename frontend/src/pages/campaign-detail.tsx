import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Globe2,
  Layers,
  Loader2,
  MousePointerClick,
  Percent,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  api,
  ApiError,
  type CampaignDetail,
  type Country,
  type Offer,
  type StatMetrics,
  type Stream,
  type StreamOffer,
} from "@/lib/api";
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  INTERVALS,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OfferCombobox } from "@/components/offer-combobox";
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
import { Sparkline } from "@/components/sparkline";
import { StatCard } from "@/components/stat-card";

type DraftOffer = StreamOffer & { isNew?: boolean };
type DraftStream = Omit<Stream, "offers" | "removed_offers"> & {
  offers: DraftOffer[];
  removed_offers: DraftOffer[];
  dirty: boolean;
};

const ZERO: StatMetrics = {
  clicks: 0,
  conversions: 0,
  revenue: 0,
  cost: 0,
  profit: 0,
  roi: 0,
  cr: 0,
  epc: 0,
};

function buildDraft(data: CampaignDetail): DraftStream[] {
  return data.streams.map((stream) => ({
    ...stream,
    offers: stream.offers.map((offer) => ({ ...offer })),
    removed_offers: stream.removed_offers.map((offer) => ({ ...offer })),
    dirty: false,
  }));
}

function mergeStats(previous: DraftStream[], data: CampaignDetail): DraftStream[] {
  const byId = new Map(data.streams.map((stream) => [stream.id, stream]));
  return previous.map((stream) => {
    const server = byId.get(stream.id);
    if (!server) return stream;
    const serverOffers = new Map(
      [...server.offers, ...server.removed_offers].map((offer) => [offer.offer_id, offer]),
    );
    const enrich = (offer: DraftOffer): DraftOffer => {
      const match = serverOffers.get(offer.offer_id);
      if (!match) return offer;
      return {
        ...offer,
        name: match.name,
        country: match.country,
        stats: match.stats,
        trend: match.trend,
        isNew: false,
      };
    };
    return {
      ...stream,
      filters: server.filters,
      country_filter: server.country_filter,
      action_payload: server.action_payload,
      clicks_today: server.clicks_today,
      stats: server.stats,
      offers: stream.offers.map(enrich),
      removed_offers: stream.removed_offers.map(enrich),
    };
  });
}

function distribute(offers: DraftOffer[]): DraftOffer[] {
  const active = offers.filter((offer) => offer.state === "active");
  const base = Math.floor(100 / Math.max(active.length, 1));
  const remainder = active.length ? 100 % active.length : 0;
  let index = 0;
  return offers.map((offer) => {
    if (offer.state !== "active") return { ...offer, share: 0 };
    const share = base + (index < remainder ? 1 : 0);
    index += 1;
    return { ...offer, share };
  });
}

function countryLabel(countries: Map<string, Country>, code: string) {
  return countries.get(code)?.name ?? code;
}

function StreamStats({ stats, currency }: { stats: StatMetrics; currency: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px]">
      <span>
        <span className="text-muted-foreground">клики </span>
        <b className="tabular-nums">{formatNumber(stats.clicks)}</b>
      </span>
      <span>
        <span className="text-muted-foreground">конв. </span>
        <b className="tabular-nums">{formatNumber(stats.conversions)}</b>
      </span>
      <span>
        <span className="text-muted-foreground">профит </span>
        <b
          className={cn(
            "tabular-nums",
            stats.profit > 0 && "text-emerald-600",
            stats.profit < 0 && "text-red-600",
          )}
        >
          {formatMoney(stats.profit, currency)}
        </b>
      </span>
    </div>
  );
}

export function CampaignDetailPage() {
  const { campaignId } = useParams();
  const id = Number(campaignId);
  const queryClient = useQueryClient();
  const [interval, setIntervalValue] = React.useState("today");
  const [draft, setDraft] = React.useState<DraftStream[] | null>(null);
  const [pickers, setPickers] = React.useState<Record<number, Offer | null>>({});
  const [saving, setSaving] = React.useState(false);

  const campaignQuery = useQuery({
    queryKey: ["campaign", id, interval],
    queryFn: () => api.campaign(id, interval),
    enabled: Number.isFinite(id) && id > 0,
  });
  const countriesQuery = useQuery({
    queryKey: ["countries"],
    queryFn: api.countries,
    staleTime: 10 * 60_000,
  });
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings,
    staleTime: 60_000,
  });
  const data = campaignQuery.data;
  const countries = React.useMemo(
    () => new Map((countriesQuery.data ?? []).map((country) => [country.code, country])),
    [countriesQuery.data],
  );

  React.useEffect(() => {
    if (!data) return;
    setDraft((previous) => {
      if (!previous) return buildDraft(data);
      if (!previous.some((stream) => stream.dirty)) return buildDraft(data);
      return mergeStats(previous, data);
    });
  }, [data]);

  const dirty = Boolean(draft?.some((stream) => stream.dirty));

  React.useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const copyText = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Не удалось скопировать в буфер обмена");
    }
  };

  const updateStream = (streamId: number, updater: (stream: DraftStream) => DraftStream) => {
    setDraft((previous) =>
      previous
        ? previous.map((stream) =>
            stream.id === streamId ? { ...updater(stream), dirty: true } : stream,
          )
        : previous,
    );
  };

  const handleAddOffer = (streamId: number) => {
    const offer = pickers[streamId];
    if (!offer || !draft) return;
    const current = draft.find((stream) => stream.id === streamId);
    if (!current) return;
    if (current.offers.some((item) => item.offer_id === offer.id)) {
      toast.info(`Оффер #${offer.id} уже есть в потоке`);
      return;
    }
    updateStream(streamId, (stream) => {
      const removed = stream.removed_offers.find((item) => item.offer_id === offer.id);
      if (removed) {
        return {
          ...stream,
          offers: distribute([
            ...stream.offers,
            { ...removed, state: "active", share: 0, isNew: false },
          ]),
          removed_offers: stream.removed_offers.filter((item) => item.offer_id !== offer.id),
        };
      }
      return {
        ...stream,
        offers: distribute([
          ...stream.offers,
          {
            offer_id: offer.id,
            name: offer.name,
            country: offer.country,
            share: 0,
            state: "active",
            stats: ZERO,
            trend: [],
            isNew: true,
          },
        ]),
      };
    });
    setPickers((previous) => ({ ...previous, [streamId]: null }));
    toast.success(`Оффер #${offer.id} добавлен в черновик`, {
      description: "Не забудьте сохранить изменения в Keitaro.",
    });
  };

  const handleRemoveOffer = (streamId: number, offerId: number) => {
    updateStream(streamId, (stream) => {
      const found = stream.offers.find((offer) => offer.offer_id === offerId);
      if (!found) return stream;
      return {
        ...stream,
        offers: distribute(stream.offers.filter((offer) => offer.offer_id !== offerId)),
        removed_offers: [
          ...stream.removed_offers,
          { ...found, share: 0, state: "removed" },
        ],
      };
    });
  };

  const handleRestoreOffer = (streamId: number, offerId: number) => {
    updateStream(streamId, (stream) => {
      const found = stream.removed_offers.find((offer) => offer.offer_id === offerId);
      if (!found) return stream;
      return {
        ...stream,
        offers: distribute([
          ...stream.offers,
          { ...found, state: "active", share: 0, isNew: false },
        ]),
        removed_offers: stream.removed_offers.filter((offer) => offer.offer_id !== offerId),
      };
    });
  };

  const cancelChanges = () => {
    if (data) setDraft(buildDraft(data));
    setPickers({});
    toast.info("Изменения отменены");
  };

  const saveChanges = async () => {
    if (!draft) return;
    const changed = draft.filter((stream) => stream.dirty);
    if (changed.length === 0) return;
    setSaving(true);
    try {
      for (const stream of changed) {
        const payload = stream.offers
          .filter((offer) => offer.state === "active" || offer.state === "disabled")
          .map((offer) => ({
            offer_id: offer.offer_id,
            share: offer.share,
            state: offer.state === "disabled" ? ("disabled" as const) : ("active" as const),
          }));
        await api.saveStreamOffers(id, stream.id, payload);
      }
      // Keitaro is now updated. Clear the draft state immediately and refresh
      // stats in the background so the save action feels instant.
      setDraft((previous) =>
        previous
          ? previous.map((stream) => ({
              ...stream,
              dirty: false,
              offers: stream.offers.map((offer) => ({ ...offer, isNew: false })),
              removed_offers: stream.removed_offers.map((offer) => ({ ...offer, isNew: false })),
            }))
          : previous,
      );
      setPickers({});
      toast.success("Изменения сохранены в Keitaro", {
        description: `Обновлено потоков: ${changed.length}`,
      });
      void (async () => {
        try {
          const fresh = await api.campaign(id, interval);
          queryClient.setQueryData(["campaign", id, interval], fresh);
          void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        } catch {
          // The draft already reflects the saved state; a later refresh will
          // reconcile stats.
        }
      })();
    } catch (error) {
      toast.error("Не удалось сохранить изменения", {
        description: error instanceof ApiError ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  if (campaignQuery.isError) {
    const message =
      campaignQuery.error instanceof ApiError
        ? campaignQuery.error.message
        : "Не удалось загрузить кампанию";
    return (
      <div className="space-y-5">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            К кампаниям
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Кампания недоступна</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (campaignQuery.isLoading || !data || !draft) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  const campaign = data.campaign;
  const offerStreams = draft.filter((stream) => stream.schema === "landings");
  const totalOffers = offerStreams.reduce((sum, stream) => sum + stream.offers.length, 0);

  return (
    <div className={cn("animate-fade-in", dirty && "pb-24")}>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Все кампании
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={`Кампания #${campaign.id}`}
        title={campaign.name}
        description={`${campaign.group ?? "Без группы"} · ${campaign.traffic_source ?? "Источник не указан"} · ${campaign.domain ?? "Домен не указан"}`}
        actions={
          <>
            <Select value={interval} onValueChange={setIntervalValue}>
              <SelectTrigger className="h-9 w-[145px]">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => campaignQuery.refetch()}
              disabled={campaignQuery.isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", campaignQuery.isFetching && "animate-spin")} />
              Обновить
            </Button>
            {campaign.admin_url && (
              <Button asChild size="sm">
                <a href={campaign.admin_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Открыть в Keitaro
                </a>
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-5 overflow-hidden">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success" className="gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              {campaign.state}
            </Badge>
            <Badge variant="outline" className="font-mono">
              {campaign.alias}
            </Badge>
            {campaign.geo.map((code) => (
              <Badge key={code} variant="outline" className="gap-1 font-normal">
                <span>{countries.get(code)?.flag ?? "🌍"}</span>
                {code}
              </Badge>
            ))}
            <span className="text-[11px] text-muted-foreground">
              создана {formatDate(campaign.created_at)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {campaign.test_url && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyText(campaign.test_url!, "Тестовая ссылка скопирована")}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Копировать ссылку
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={campaign.test_url} target="_blank" rel="noreferrer">
                    <Globe2 className="h-3.5 w-3.5" />
                    Проверить
                  </a>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Клики" value={formatNumber(data.totals.clicks)} icon={MousePointerClick} />
        <StatCard
          label="Конверсии"
          value={formatNumber(data.totals.conversions)}
          hint={`CR ${formatPercent(data.totals.cr)}`}
          icon={Check}
        />
        <StatCard
          label="Выручка"
          value={formatMoney(data.totals.revenue, campaign.currency)}
          icon={Wallet}
        />
        <StatCard
          label="Профит"
          value={formatMoney(data.totals.profit, campaign.currency)}
          icon={CircleDollarSign}
          tone={data.totals.profit > 0 ? "positive" : data.totals.profit < 0 ? "negative" : "default"}
        />
        <StatCard
          label="ROI"
          value={formatPercent(data.totals.roi)}
          icon={Percent}
          tone={data.totals.roi > 0 ? "positive" : data.totals.roi < 0 ? "negative" : "default"}
        />
        <StatCard label="Офферов в потоках" value={formatNumber(totalOffers)} icon={Layers} />
      </div>

      {dirty && (
        <Alert variant="warning" className="mb-5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Есть несохранённые изменения</AlertTitle>
          <AlertDescription>
            Офферы и доли изменены только в интерфейсе. Нажмите «Сохранить в Keitaro», чтобы
            применить их в трекере.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-5">
        {draft.map((stream) => {
          const isOfferStream = stream.schema === "landings";
          const activeOffers = stream.offers.filter((offer) => offer.state !== "removed");
          return (
            <Card key={stream.id} className={cn("overflow-hidden", stream.dirty && "ring-1 ring-primary/30")}>
              <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-sm">
                    {isOfferStream ? <Layers className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{stream.name}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        #{stream.position}
                      </Badge>
                      <Badge variant="muted" className="text-[10px]">
                        {stream.schema}
                      </Badge>
                      {stream.country_filter.length > 0 && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <TargetIcon />
                          {stream.country_filter
                            .map((code) => countries.get(code)?.flag ?? code)
                            .join(" ")}
                        </Badge>
                      )}
                      {stream.dirty && (
                        <Badge variant="warning" className="text-[10px]">
                          изменён
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="font-mono">stream_id {stream.id}</span>
                      <span>кликов сегодня: {formatNumber(stream.clicks_today)}</span>
                      {stream.action_payload && (
                        <a
                          href={stream.action_payload}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {stream.action_payload}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <StreamStats stats={stream.stats} currency={campaign.currency} />
              </div>

              <CardContent className="p-0">
                {isOfferStream ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-background hover:bg-background">
                          <TableHead className="min-w-[300px]">Оффер</TableHead>
                          <TableHead className="w-[140px]">Доля</TableHead>
                          <TableHead className="text-right">Клики</TableHead>
                          <TableHead className="text-right">Конв.</TableHead>
                          <TableHead className="text-right">Выручка</TableHead>
                          <TableHead className="text-right">Профит</TableHead>
                          <TableHead className="text-right">ROI</TableHead>
                          <TableHead className="w-[120px]">Тренд</TableHead>
                          <TableHead className="w-[130px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeOffers.map((offer) => (
                          <OfferRow
                            key={`${stream.id}-${offer.offer_id}`}
                            offer={offer}
                            countries={countries}
                            currency={campaign.currency}
                            keitaroBaseUrl={settingsQuery.data?.keitaro_base_url}
                            onRemove={() => handleRemoveOffer(stream.id, offer.offer_id)}
                          />
                        ))}
                        {stream.removed_offers.map((offer) => (
                          <OfferRow
                            key={`${stream.id}-removed-${offer.offer_id}`}
                            offer={offer}
                            countries={countries}
                            currency={campaign.currency}
                            keitaroBaseUrl={settingsQuery.data?.keitaro_base_url}
                            removed
                            onRestore={() => handleRestoreOffer(stream.id, offer.offer_id)}
                          />
                        ))}
                        {activeOffers.length === 0 && stream.removed_offers.length === 0 && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                              В потоке пока нет офферов. Добавьте первый оффер ниже.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>

                    <div className="border-t bg-muted/10 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <OfferCombobox
                            value={pickers[stream.id] ?? null}
                            onChange={(offer) =>
                              setPickers((previous) => ({ ...previous, [stream.id]: offer }))
                            }
                            placeholder="Добавить оффер в поток — поиск по названию или ID"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => handleAddOffer(stream.id)}
                          disabled={!pickers[stream.id]}
                          className="shrink-0"
                        >
                          <Plus className="h-4 w-4" />
                          Добавить
                        </Button>
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Sparkles className="h-3 w-3 text-primary" />
                        Доли пересчитываются поровну между активными офферами и всегда дают 100%.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <ArrowRight className="h-4 w-4 text-primary" />
                        Редирект на внешний URL
                      </div>
                      <div className="mt-1 break-all text-xs text-muted-foreground">
                        {stream.action_payload || "URL не указан"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {stream.country_filter.map((code) => (
                        <Badge key={code} variant="outline" className="gap-1">
                          <span>{countries.get(code)?.flag ?? "🌍"}</span>
                          {countryLabel(countries, code)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur lg:left-[260px]">
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Несохранённые изменения</div>
                <div className="text-[11px] text-muted-foreground">
                  Изменено потоков: {draft.filter((stream) => stream.dirty).length}. Применение
                  займёт пару секунд.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={cancelChanges} disabled={saving}>
                <RotateCcw className="h-4 w-4" />
                Отменить
              </Button>
              <Button onClick={saveChanges} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Сохраняем…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Сохранить в Keitaro
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TargetIcon() {
  return <MousePointerClick className="h-3 w-3" />;
}

function OfferRow({
  offer,
  countries,
  currency,
  keitaroBaseUrl,
  removed,
  onRemove,
  onRestore,
}: {
  offer: DraftOffer;
  countries: Map<string, Country>;
  currency: string;
  keitaroBaseUrl?: string;
  removed?: boolean;
  onRemove?: () => void;
  onRestore?: () => void;
}) {
  const isRemoved = removed || offer.state === "removed";
  const positive = offer.stats.profit >= 0;
  return (
    <TableRow className={cn(isRemoved && "bg-muted/20 text-muted-foreground opacity-75")}>
      <TableCell>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-6 w-10 shrink-0 items-center justify-center rounded bg-secondary text-[10px] font-bold text-primary">
            #{offer.offer_id}
          </span>
          <div className="min-w-0">
            <div
              className={cn(
                "max-w-[420px] truncate text-[13px] font-medium",
                isRemoved && "line-through",
              )}
              title={offer.name}
            >
              {offer.name}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {offer.isNew && (
                <Badge variant="success" className="px-1.5 py-0 text-[9px]">
                  новый
                </Badge>
              )}
              {isRemoved && (
                <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
                  удалён
                </Badge>
              )}
              {offer.country.slice(0, 4).map((code) => (
                <Badge key={code} variant="muted" className="px-1.5 py-0 text-[9px]">
                  {countries.get(code)?.flag ?? "🌍"} {code}
                </Badge>
              ))}
              {keitaroBaseUrl && (
                <a
                  href={`${keitaroBaseUrl}/admin/#!/offers/${offer.offer_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                >
                  открыть
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", isRemoved ? "bg-muted-foreground/30" : "bg-primary")}
              style={{ width: `${Math.max(0, Math.min(100, offer.share))}%` }}
            />
          </div>
          <span className="w-9 text-right text-xs font-semibold tabular-nums">{offer.share}%</span>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(offer.stats.clicks)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatNumber(offer.stats.conversions)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(offer.stats.revenue, currency)}
      </TableCell>
      <TableCell className="text-right">
        <span
          className={cn(
            "font-medium tabular-nums",
            !isRemoved && offer.stats.profit > 0 && "text-emerald-600",
            !isRemoved && offer.stats.profit < 0 && "text-red-600",
          )}
        >
          {formatMoney(offer.stats.profit, currency)}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <span
          className={cn(
            "inline-flex items-center gap-1 font-medium tabular-nums",
            !isRemoved && offer.stats.roi > 0 && "text-emerald-600",
            !isRemoved && offer.stats.roi < 0 && "text-red-600",
          )}
        >
          {!isRemoved && offer.stats.roi > 0 && <TrendingUp className="h-3 w-3" />}
          {!isRemoved && offer.stats.roi < 0 && <TrendingDown className="h-3 w-3" />}
          {formatPercent(offer.stats.roi)}
        </span>
      </TableCell>
      <TableCell>
        <Sparkline
          data={offer.trend}
          color={isRemoved ? "#9ca3af" : positive ? "#2f9e44" : "#dc2626"}
          dataKey="clicks"
        />
      </TableCell>
      <TableCell>
        {isRemoved ? (
          <Button variant="outline" size="sm" onClick={onRestore}>
            <RotateCcw className="h-3.5 w-3.5" />
            Вернуть
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Удалить
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
