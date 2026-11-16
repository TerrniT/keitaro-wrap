import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import type { Country } from "@/lib/api";
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

interface CountryMultiSelectProps {
  countries: Country[];
  value: string[];
  onChange: (codes: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function CountryMultiSelect({
  countries,
  value,
  onChange,
  placeholder = "Выберите страны",
  className,
}: CountryMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = value
    .map((code) => countries.find((country) => country.code === code))
    .filter(Boolean) as Country[];

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return countries.slice(0, 60);
    return countries
      .filter(
        (country) =>
          country.name.toLowerCase().includes(needle) ||
          country.code.toLowerCase().includes(needle),
      )
      .slice(0, 60);
  }, [countries, search]);

  const toggle = (code: string) => {
    if (value.includes(code)) onChange(value.filter((item) => item !== code));
    else onChange([...value, code]);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-10 w-full justify-between px-3 py-2 font-normal"
          >
            <span className="flex flex-1 flex-wrap items-center gap-1.5 text-left">
              {selected.length === 0 && (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
              {selected.slice(0, 5).map((country) => (
                <Badge key={country.code} variant="secondary" className="gap-1 font-normal">
                  <span>{country.flag}</span>
                  <span>{country.code}</span>
                </Badge>
              ))}
              {selected.length > 5 && (
                <Badge variant="muted" className="font-normal">
                  +{selected.length - 5}
                </Badge>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Страна или код (например, US)"
            />
            <CommandList>
              <CommandEmpty>Страна не найдена</CommandEmpty>
              <CommandGroup>
                {filtered.map((country) => {
                  const isSelected = value.includes(country.code);
                  return (
                    <CommandItem
                      key={country.code}
                      value={country.code}
                      onSelect={() => toggle(country.code)}
                      className="gap-2"
                    >
                      <span className="text-base leading-none">{country.flag}</span>
                      <span className="flex-1 truncate">{country.name}</span>
                      <span className="text-xs text-muted-foreground">{country.code}</span>
                      <Check
                        className={cn(
                          "h-4 w-4 text-primary",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((country) => (
            <Badge key={country.code} variant="outline" className="gap-1.5 bg-background py-1 font-normal">
              <span>{country.flag}</span>
              <span>{country.name}</span>
              <button
                type="button"
                className="ml-0.5 rounded-full text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => onChange(value.filter((code) => code !== country.code))}
                aria-label={`Убрать ${country.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
