import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Search, Tag } from "lucide-react";

import { api, type Offer } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface OfferComboboxProps {
  value: Offer | null;
  onChange: (offer: Offer | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function OfferCombobox({
  value,
  onChange,
  placeholder = "Найдите оффер по названию или ID",
  className,
  disabled,
}: OfferComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["offers", debounced],
    queryFn: () => api.offers(debounced, debounced ? 30 : 50),
    enabled: open,
    staleTime: 60_000,
  });

  const offers = data?.items ?? [];

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-auto min-h-10 w-full justify-between px-3 py-2 text-left font-normal",
            className,
          )}
        >
          {value ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-[10px] font-bold text-primary">
                #{value.id}
              </span>
              <span className="truncate">{value.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Название, ID или часть названия…"
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загружаем офферы из Keitaro…
              </div>
            ) : (
              <>
                <CommandEmpty>Офферы не найдены</CommandEmpty>
                <CommandGroup heading={`Доступные офферы${data ? ` · ${data.total}` : ""}`}>
                  {offers.map((offer) => (
                    <CommandItem
                      key={offer.id}
                      value={String(offer.id)}
                      onSelect={() => {
                        onChange(offer);
                        setOpen(false);
                      }}
                      className="items-start gap-2 py-2.5"
                    >
                      <span className="mt-0.5 flex h-6 w-9 shrink-0 items-center justify-center rounded bg-secondary text-[10px] font-bold text-primary">
                        #{offer.id}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{offer.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          {offer.country?.slice(0, 3).map((code) => (
                            <Badge key={code} variant="muted" className="px-1.5 py-0 text-[9px]">
                              {code}
                            </Badge>
                          ))}
                          {offer.group_id && (
                            <span className="text-[10px] text-muted-foreground">
                              группа {offer.group_id}
                            </span>
                          )}
                        </span>
                      </span>
                      <Check
                        className={cn(
                          "mt-1 h-4 w-4 shrink-0 text-primary",
                          value?.id === offer.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
          <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Tag className="h-3 w-3" />
              {isFetching ? "Обновляем…" : "Кэш офферов Keitaro"}
            </span>
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setSearch("")}
            >
              Сбросить поиск
            </button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
