import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Globe2,
  Layers,
  Loader2,
  Plus,
  Rocket,
  Server,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { api, ApiError, type Offer } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CountryMultiSelect } from "@/components/country-multiselect";
import { OfferCombobox } from "@/components/offer-combobox";
import { PageHeader } from "@/components/page-header";

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [geo, setGeo] = React.useState<string[]>([]);
  const [offer, setOffer] = React.useState<Offer | null>(null);
  const [domainId, setDomainId] = React.useState<string>("");
  const [groupId, setGroupId] = React.useState<string>("");
  const [sourceId, setSourceId] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [initialized, setInitialized] = React.useState(false);

  const metaQuery = useQuery({
    queryKey: ["meta"],
    queryFn: () => api.meta(),
    staleTime: 60_000,
    retry: 1,
  });
  const meta = metaQuery.data;

  React.useEffect(() => {
    if (!meta || initialized) return;
    setDomainId(
      String(meta.settings.default_domain_id ?? meta.domains.find((item) => item.state === "active")?.id ?? ""),
    );
    setGroupId(String(meta.settings.default_group_id ?? meta.groups[0]?.id ?? ""));
    setSourceId(
      String(meta.settings.default_traffic_source_id ?? meta.sources.find((item) => item.state === "active")?.id ?? ""),
    );
    setInitialized(true);
  }, [meta, initialized]);

  const prefix = meta?.settings.campaign_prefix ?? "test_kotovsky_";
  const finalName = `${prefix}${name.trim() || "campaign1"}`;
  const countries = React.useMemo(
    () => new Map((meta?.countries ?? []).map((country) => [country.code, country])),
    [meta],
  );
  const selectedDomain = meta?.domains.find((item) => String(item.id) === domainId);
  const selectedGroup = meta?.groups.find((item) => String(item.id) === groupId);
  const selectedSource = meta?.sources.find((item) => String(item.id) === sourceId);

  const canSubmit =
    Boolean(meta?.connection_ok) &&
    Boolean(name.trim()) &&
    geo.length > 0 &&
    Boolean(offer) &&
    Boolean(domainId) &&
    Boolean(groupId) &&
    Boolean(sourceId) &&
    !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!offer) return;
    setSubmitting(true);
    try {
      const detail = await api.createCampaign({
        name: finalName,
        geo,
        offer_id: offer.id,
        domain_id: Number(domainId),
        group_id: Number(groupId),
        traffic_source_id: Number(sourceId),
      });
      toast.success("Кампания создана", {
        description: `${detail.campaign.name} · два потока уже настроены`,
      });
      navigate(`/campaigns/${detail.campaign.id}`);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Не удалось создать кампанию";
      toast.error("Keitaro вернул ошибку", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Конструктор связки"
        title="Новая кампания"
        description="Заполните три поля — остальное обёртка сделает сама: создаст кампанию, привяжет домен, группу и источник, а также настроит два потока."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              К кампаниям
            </Link>
          </Button>
        }
      />

      {metaQuery.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-[520px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      ) : !meta ? (
        <Alert variant="destructive">
          <Target className="h-4 w-4" />
          <AlertTitle>Не удалось загрузить справочники</AlertTitle>
          <AlertDescription>
            Проверьте, что backend запущен и `KEITARO_API_KEY` заполнен.{" "}
            <Link to="/settings" className="font-semibold underline underline-offset-2">
              Открыть настройки
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : !meta.connection_ok ? (
        <Alert variant="warning">
          <Target className="h-4 w-4" />
          <AlertTitle>Keitaro недоступен</AlertTitle>
          <AlertDescription>
            {meta.connection_error}. Проверьте ключ и адрес в{" "}
            <Link to="/settings" className="font-semibold underline underline-offset-2">
              настройках
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    1
                  </span>
                  Основное
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Название кампании</Label>
                  <div className="flex rounded-md border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                    <span className="flex items-center rounded-l-md border-r bg-muted/60 px-3 font-mono text-xs text-muted-foreground">
                      {prefix}
                    </span>
                    <input
                      id="campaign-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="campaign1"
                      className="h-10 w-full rounded-r-md bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                      autoComplete="off"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Итоговое имя: <span className="font-mono text-foreground">{finalName}</span>.
                    Префикс меняется в настройках.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Гео</Label>
                  <CountryMultiSelect
                    countries={meta?.countries ?? []}
                    value={geo}
                    onChange={setGeo}
                    placeholder="Страны, которые пойдут на Google"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Можно выбрать несколько стран. Они попадут в фильтр первого потока.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Оффер</Label>
                  <OfferCombobox value={offer} onChange={setOffer} />
                  <p className="text-[11px] text-muted-foreground">
                    Поиск идёт по кэшу офферов Keitaro. Выбранный оффер будет добавлен во второй
                    поток со 100% трафика.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    2
                  </span>
                  Куда создать
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Домен</Label>
                  <Select value={domainId} onValueChange={setDomainId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Домен" />
                    </SelectTrigger>
                    <SelectContent>
                      {meta?.domains.map((domain) => (
                        <SelectItem key={domain.id} value={String(domain.id)}>
                          {domain.name}
                          {domain.is_ssl ? " · SSL" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Группа</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Группа" />
                    </SelectTrigger>
                    <SelectContent>
                      {meta?.groups.map((group) => (
                        <SelectItem key={group.id} value={String(group.id)}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Источник</Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Источник" />
                    </SelectTrigger>
                    <SelectContent>
                      {meta?.sources.map((source) => (
                        <SelectItem key={source.id} value={String(source.id)}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button asChild type="button" variant="ghost">
                <Link to="/">Отмена</Link>
              </Button>
              <Button type="submit" disabled={!canSubmit} size="lg" className="min-w-[200px]">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Создаём в Keitaro…
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Создать кампанию
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-5">
            <Card className="overflow-hidden">
              <div className="border-b bg-sidebar px-5 py-4 text-white">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Globe2 className="h-4 w-4 text-primary" />
                  Предпросмотр связки
                </div>
                <p className="mt-1 text-[11px] text-white/50">
                  Так кампания будет выглядеть в Keitaro
                </p>
              </div>
              <CardContent className="space-y-4 p-5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Название
                  </div>
                  <div className="mt-1 break-all font-mono text-sm font-semibold">{finalName}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Гео
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {geo.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Не выбрано</span>
                    ) : (
                      geo.map((code) => (
                        <Badge key={code} variant="outline" className="gap-1 font-normal">
                          <span>{countries.get(code)?.flag ?? "🌍"}</span>
                          {code}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Потоки
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-background text-[10px] font-bold text-primary">
                        1
                      </span>
                      Google
                      <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="mt-1 pl-8 text-[11px] text-muted-foreground">
                      {geo.length > 0 ? geo.join(", ") : "выбранные страны"} → https://www.google.com
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-background text-[10px] font-bold text-primary">
                        2
                      </span>
                      Offers
                      <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="mt-1 break-all pl-8 text-[11px] text-muted-foreground">
                      {offer ? `#${offer.id} ${offer.name}` : "выбранный оффер"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 border-t pt-3 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Server className="h-3 w-3" /> Домен
                    </span>
                    <span className="truncate font-medium">{selectedDomain?.name ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Layers className="h-3 w-3" /> Группа
                    </span>
                    <span className="truncate font-medium">{selectedGroup?.name ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Target className="h-3 w-3" /> Источник
                    </span>
                    <span className="truncate font-medium">{selectedSource?.name ?? "—"}</span>
                  </div>
                </div>
                {offer && (
                  <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-[11px] text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Оффер активен. После создания можно сразу добавлять и удалять офферы в
                      редакторе.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-dashed bg-transparent shadow-none">
              <CardContent className="flex gap-3 p-4 text-[11px] leading-relaxed text-muted-foreground">
                <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Если нужного домена, группы или источника нет в списке, создайте его в Keitaro.
                  Обёртка читает справочники через Admin API.
                </span>
              </CardContent>
            </Card>
          </div>
        </form>
      )}
    </div>
  );
}
