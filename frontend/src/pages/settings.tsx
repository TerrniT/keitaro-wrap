import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [prefix, setPrefix] = React.useState("");
  const [domainId, setDomainId] = React.useState("");
  const [groupId, setGroupId] = React.useState("");
  const [sourceId, setSourceId] = React.useState("");
  const [initialized, setInitialized] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

  const metaQuery = useQuery({
    queryKey: ["meta"],
    queryFn: () => api.meta(),
    staleTime: 30_000,
  });
  const meta = metaQuery.data;

  React.useEffect(() => {
    if (!meta || initialized) return;
    setPrefix(meta.settings.campaign_prefix);
    setDomainId(String(meta.settings.default_domain_id ?? ""));
    setGroupId(String(meta.settings.default_group_id ?? ""));
    setSourceId(String(meta.settings.default_traffic_source_id ?? ""));
    setInitialized(true);
  }, [meta, initialized]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updated = await api.updateSettings({
        campaign_prefix: prefix,
        default_domain_id: domainId ? Number(domainId) : null,
        default_group_id: groupId ? Number(groupId) : null,
        default_traffic_source_id: sourceId ? Number(sourceId) : null,
      });
      setPrefix(updated.campaign_prefix);
      setDomainId(String(updated.default_domain_id ?? ""));
      setGroupId(String(updated.default_group_id ?? ""));
      setSourceId(String(updated.default_traffic_source_id ?? ""));
      await queryClient.invalidateQueries({ queryKey: ["meta"] });
      toast.success("Настройки сохранены");
    } catch (error) {
      toast.error("Не удалось сохранить настройки", {
        description: error instanceof ApiError ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const syncOffers = async () => {
    setSyncing(true);
    try {
      const result = await api.syncOffers();
      await queryClient.invalidateQueries({ queryKey: ["meta"] });
      await queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Кэш офферов обновлён", {
        description: `Загружено офферов: ${result.synced}`,
      });
    } catch (error) {
      toast.error("Не удалось синхронизировать офферы", {
        description: error instanceof ApiError ? error.message : String(error),
      });
    } finally {
      setSyncing(false);
    }
  };

  const checkConnection = async () => {
    try {
      const fresh = await api.meta(true);
      queryClient.setQueryData(["meta"], fresh);
      if (fresh.connection_ok) toast.success("Keitaro отвечает");
      else toast.error("Keitaro недоступен", { description: fresh.connection_error ?? undefined });
    } catch (error) {
      toast.error("Проверка не удалась", {
        description: error instanceof ApiError ? error.message : String(error),
      });
    }
  };

  if (metaQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-[360px] w-full rounded-xl" />
      </div>
    );
  }

  if (!meta) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить настройки</AlertTitle>
        <AlertDescription>
          Проверьте, что backend запущен и переменные окружения заполнены.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Конфигурация"
        title="Настройки"
        description="Параметры по умолчанию для создаватора кампаний и состояние подключения к Keitaro."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="https://docs.keitaro.io/en/team-management/admin-api-keys.html" target="_blank" rel="noreferrer">
              <KeyRound className="h-4 w-4" />
              Как получить API-ключ
            </a>
          </Button>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Значения по умолчанию
              </CardTitle>
              <CardDescription>
                Подставляются в форму создания кампании. Их всегда можно изменить вручную.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="prefix">Префикс названия</Label>
                <Input
                  id="prefix"
                  value={prefix}
                  onChange={(event) => setPrefix(event.target.value)}
                  placeholder="test_kotovsky_"
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Должен начинаться с <code className="rounded bg-muted px-1">test_</code> и
                  заканчиваться подчёркиванием. Пример:{" "}
                  <span className="font-mono text-foreground">{prefix || "test_"}campaign1</span>
                </p>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Домен</Label>
                  <Select value={domainId} onValueChange={setDomainId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Не выбран" />
                    </SelectTrigger>
                    <SelectContent>
                      {meta?.domains.map((domain) => (
                        <SelectItem key={domain.id} value={String(domain.id)}>
                          {domain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Группа</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Не выбрана" />
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
                      <SelectValue placeholder="Не выбран" />
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
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Сохранить настройки
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Кэш офферов
              </CardTitle>
              <CardDescription>
                Локальный поиск по офферам Keitaro — быстрый автокомплит без задержек API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Офферов в кэше
                  </div>
                  <div className="mt-1 text-2xl font-bold">{meta?.settings.offers_cached ?? 0}</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Последняя синхронизация
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {meta?.settings.offers_synced_at
                      ? formatDateTime(meta.settings.offers_synced_at)
                      : "Ещё не было"}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  Синхронизация читает список офферов, доступных вашему API-пользователю.
                </p>
                <Button variant="outline" onClick={syncOffers} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Обновить кэш
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                Подключение
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Адрес трекера
                </div>
                <div className="break-all font-mono text-sm">{meta?.keitaro_base_url}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  API-ключ
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={meta?.api_key_configured ? "success" : "destructive"}>
                    {meta?.api_key_configured ? "настроен" : "не настроен"}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    хранится только на сервере
                  </span>
                </div>
              </div>
              <Separator />
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg p-3 text-xs",
                  meta?.connection_ok
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-red-50 text-red-800",
                )}
              >
                {meta?.connection_ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div className="space-y-1">
                  <div className="font-medium">
                    {meta?.connection_ok ? "Соединение установлено" : "Нет соединения"}
                  </div>
                  {!meta?.connection_ok && meta?.connection_error && (
                    <div className="break-words opacity-80">{meta.connection_error}</div>
                  )}
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={checkConnection}>
                <RefreshCw className="h-4 w-4" />
                Проверить подключение
              </Button>
            </CardContent>
          </Card>

          <Alert variant="warning">
            <KeyRound className="h-4 w-4" />
            <AlertTitle>Где взять ключ</AlertTitle>
            <AlertDescription>
              В Keitaro нажмите на иконку профиля справа сверху → <b>Account</b> →{" "}
              <b>API keys</b> → <b>Create API key</b>. Затем добавьте его в{" "}
              <code className="rounded bg-amber-100 px-1">KEITARO_API_KEY</code> в файле{" "}
              <code className="rounded bg-amber-100 px-1">.env</code> и перезапустите backend.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
