/**
 * TenantCombobox — Seletor de tenant (admin) para Etapa 1D Fase A3.2.
 *
 * Lê a tabela `tenants` direto (mesmo padrão de PlatformTenants.tsx).
 * Acesso já é restringido por RLS server-side a platform_admin.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

interface TenantOption {
  id: string;
  name: string;
  slug: string | null;
}

interface TenantComboboxProps {
  value: string | null;
  onChange: (tenantId: string | null, tenant: TenantOption | null) => void;
  placeholder?: string;
}

export function TenantCombobox({
  value,
  onChange,
  placeholder = "Selecione um tenant…",
}: TenantComboboxProps) {
  const [open, setOpen] = useState(false);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["platform-tenants-combobox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TenantOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const selected = useMemo(
    () => (value ? tenants?.find((t) => t.id === value) ?? null : null),
    [tenants, value]
  );

  if (isLoading && !tenants) {
    return <Skeleton className="h-10 w-[280px]" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[280px] justify-between"
        >
          <span className="flex items-center gap-2 truncate">
            <Store className="h-4 w-4 text-muted-foreground" />
            {selected ? selected.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar tenant…" />
          <CommandList>
            <CommandEmpty>Nenhum tenant encontrado.</CommandEmpty>
            <CommandGroup>
              {(tenants ?? []).map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.name} ${t.slug ?? ""}`}
                  onSelect={() => {
                    onChange(t.id, t);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === t.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{t.name}</span>
                    {t.slug && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {t.slug}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
