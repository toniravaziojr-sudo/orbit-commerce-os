// =============================================
// AddressFields — Componente único de endereço guiado
// Fluxo: CEP → UF → Cidade (IBGE) → Rua → Bairro → Número → Complemento
// Regras:
//  - UF SEMPRE é dropdown fechado (27 UFs oficiais). Nunca texto livre.
//  - Cidade SEMPRE é dropdown filtrado pela UF, com base oficial IBGE.
//  - Busca CEP dispara automaticamente ao sair do campo (8 dígitos).
//  - Campos subsequentes ficam bloqueados até UF ser válida.
//  - Trocar UF reseta a Cidade.
// =============================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, Check, ChevronsUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { CepInput } from '@/components/storefront/shared/CepInput';
import { sanitizeCep, isValidCep } from '@/lib/cepUtils';
import { useCepLookup } from '@/hooks/useCepLookup';
import { useIbgeMunicipios } from '@/hooks/useIbgeMunicipios';
import { BRAZILIAN_STATES, isValidUf } from '@/lib/brazilianStates';

export interface AddressFieldsValue {
  postalCode: string;
  state: string;
  city: string;
  street: string;
  neighborhood: string;
  number: string;
  complement: string;
  /** Código IBGE de 7 dígitos da cidade (preenchido automaticamente). */
  ibgeCode?: string;
}

export interface AddressFieldsErrors {
  postalCode?: string;
  state?: string;
  city?: string;
  street?: string;
  neighborhood?: string;
  number?: string;
}

interface AddressFieldsProps {
  value: AddressFieldsValue;
  errors?: AddressFieldsErrors;
  onChange: (next: AddressFieldsValue) => void;
  disabled?: boolean;
  idPrefix?: string;
  className?: string;
}

export function AddressFields({
  value,
  errors,
  onChange,
  disabled,
  idPrefix = 'addr',
  className,
}: AddressFieldsProps) {
  const { lookupCep, isLoading: isLookingUp } = useCepLookup();
  const numberRef = useRef<HTMLInputElement>(null);
  const [cityOpen, setCityOpen] = useState(false);

  const ufValid = isValidUf(value.state);
  const { municipios, isLoading: isLoadingCities } = useIbgeMunicipios(ufValid ? value.state : '');

  const update = useCallback(
    (patch: Partial<AddressFieldsValue>) => {
      onChange({ ...value, ...patch });
    },
    [onChange, value],
  );

  // Auto lookup CEP (executa apenas quando atinge 8 dígitos e ainda não há rua/cidade preenchidas
  // — evita re-disparar ao editar manualmente).
  const lastLookupRef = useRef<string>('');
  const handleCepBlur = useCallback(async () => {
    const cep = sanitizeCep(value.postalCode);
    if (!isValidCep(cep)) return;
    if (lastLookupRef.current === cep) return;
    lastLookupRef.current = cep;

    const result = await lookupCep(cep);
    if (!result) return;
    const next: Partial<AddressFieldsValue> = {};
    if (result.state) next.state = result.state.toUpperCase();
    if (result.city) next.city = result.city;
    if (result.street) next.street = result.street;
    if (result.neighborhood) next.neighborhood = result.neighborhood;
    if (result.ibge_code) next.ibgeCode = result.ibge_code;
    onChange({ ...value, ...next });
    // Foca número assim que o CEP completa rua
    if (result.street) {
      setTimeout(() => numberRef.current?.focus(), 50);
    }
  }, [value, onChange, lookupCep]);

  const handleManualLookup = async () => {
    lastLookupRef.current = '';
    await handleCepBlur();
  };

  // Quando UF muda manualmente para uma diferente do que estava no IBGE/Cidade atual,
  // limpa cidade e ibge (mantém coerência).
  const handleStateChange = (nextUf: string) => {
    if (nextUf === value.state) return;
    update({ state: nextUf, city: '', ibgeCode: '' });
  };

  const handleCityChange = (cityName: string) => {
    const found = municipios.find((m) => m.nome === cityName);
    update({
      city: cityName,
      ibgeCode: found ? String(found.id) : '',
    });
    setCityOpen(false);
  };

  // Garante que o ibgeCode bate com a cidade quando a lista carrega depois.
  useEffect(() => {
    if (!ufValid || !value.city || value.ibgeCode || municipios.length === 0) return;
    const found = municipios.find((m) => m.nome.toLowerCase() === value.city.toLowerCase());
    if (found) {
      update({ city: found.nome, ibgeCode: String(found.id) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipios, ufValid]);

  const cepValid = isValidCep(sanitizeCep(value.postalCode));
  const dependentsDisabled = disabled || !ufValid;

  const cityDisplay = useMemo(() => value.city || '', [value.city]);

  return (
    <div className={cn('grid gap-4', className)}>
      {/* CEP */}
      <div className="max-w-[260px]">
        <Label htmlFor={`${idPrefix}-cep`}>CEP *</Label>
        <div className="flex gap-2">
          <CepInput
            id={`${idPrefix}-cep`}
            source={idPrefix}
            value={value.postalCode}
            onValueChange={(digits) => update({ postalCode: digits })}
            onBlur={handleCepBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleManualLookup();
              }
            }}
            placeholder="00000000"
            disabled={disabled}
            className={errors?.postalCode ? 'border-destructive' : ''}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleManualLookup}
            disabled={disabled || isLookingUp || !cepValid}
            title="Buscar endereço pelo CEP"
          >
            {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {errors?.postalCode && <p className="text-sm text-destructive mt-1">{errors.postalCode}</p>}
        <p className="text-xs text-muted-foreground mt-1">
          Digite o CEP — buscaremos o endereço automaticamente.
        </p>
      </div>

      {/* UF + Cidade */}
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4">
        <div>
          <Label htmlFor={`${idPrefix}-state`}>Estado *</Label>
          <Select
            value={value.state || ''}
            onValueChange={handleStateChange}
            disabled={disabled}
          >
            <SelectTrigger
              id={`${idPrefix}-state`}
              className={errors?.state ? 'border-destructive' : ''}
            >
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {BRAZILIAN_STATES.map((s) => (
                <SelectItem key={s.uf} value={s.uf}>
                  {s.uf} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.state && <p className="text-sm text-destructive mt-1">{errors.state}</p>}
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-city`}>Cidade *</Label>
          <Popover open={cityOpen} onOpenChange={setCityOpen}>
            <PopoverTrigger asChild>
              <Button
                id={`${idPrefix}-city`}
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={cityOpen}
                disabled={dependentsDisabled || isLoadingCities}
                className={cn(
                  'w-full justify-between font-normal',
                  !cityDisplay && 'text-muted-foreground',
                  errors?.city && 'border-destructive',
                )}
              >
                {isLoadingCities
                  ? 'Carregando cidades...'
                  : cityDisplay || (ufValid ? 'Selecione a cidade' : 'Selecione o estado primeiro')}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar cidade..." />
                <CommandList>
                  <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                  <CommandGroup>
                    {municipios.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={m.nome}
                        onSelect={() => handleCityChange(m.nome)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            cityDisplay === m.nome ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        {m.nome}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {errors?.city && <p className="text-sm text-destructive mt-1">{errors.city}</p>}
        </div>
      </div>

      {/* Rua */}
      <div>
        <Label htmlFor={`${idPrefix}-street`}>Rua / Logradouro *</Label>
        <Input
          id={`${idPrefix}-street`}
          value={value.street}
          onChange={(e) => update({ street: e.target.value })}
          disabled={dependentsDisabled}
          className={errors?.street ? 'border-destructive' : ''}
        />
        {errors?.street && <p className="text-sm text-destructive mt-1">{errors.street}</p>}
      </div>

      {/* Bairro + Número + Complemento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor={`${idPrefix}-neighborhood`}>Bairro *</Label>
          <Input
            id={`${idPrefix}-neighborhood`}
            value={value.neighborhood}
            onChange={(e) => update({ neighborhood: e.target.value })}
            disabled={dependentsDisabled}
            className={errors?.neighborhood ? 'border-destructive' : ''}
          />
          {errors?.neighborhood && <p className="text-sm text-destructive mt-1">{errors.neighborhood}</p>}
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-number`}>Número *</Label>
          <Input
            id={`${idPrefix}-number`}
            ref={numberRef}
            value={value.number}
            onChange={(e) => update({ number: e.target.value })}
            disabled={dependentsDisabled}
            className={errors?.number ? 'border-destructive' : ''}
          />
          {errors?.number && <p className="text-sm text-destructive mt-1">{errors.number}</p>}
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-complement`}>Complemento</Label>
          <Input
            id={`${idPrefix}-complement`}
            value={value.complement}
            onChange={(e) => update({ complement: e.target.value })}
            placeholder="Apto, bloco, etc."
            disabled={dependentsDisabled}
          />
        </div>
      </div>
    </div>
  );
}
