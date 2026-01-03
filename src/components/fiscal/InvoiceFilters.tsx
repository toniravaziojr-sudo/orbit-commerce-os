import { useState } from 'react';
import { Filter, X, Calendar, DollarSign, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface InvoiceFilters {
  startDate?: Date;
  endDate?: Date;
  minValue?: number;
  maxValue?: number;
  destNome?: string;
  destCpfCnpj?: string;
  numero?: string;
}

interface InvoiceFiltersProps {
  filters: InvoiceFilters;
  onChange: (filters: InvoiceFilters) => void;
  onClear: () => void;
}

export function InvoiceFiltersComponent({ filters, onChange, onClear }: InvoiceFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<InvoiceFilters>(filters);

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  const handleApply = () => {
    onChange(localFilters);
    setIsOpen(false);
  };

  const handleClear = () => {
    setLocalFilters({});
    onClear();
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filtros Avançados</h4>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Período
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                    {localFilters.startDate 
                      ? format(localFilters.startDate, 'dd/MM/yy') 
                      : 'De'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={localFilters.startDate}
                    onSelect={(date) => setLocalFilters({ ...localFilters, startDate: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                    {localFilters.endDate 
                      ? format(localFilters.endDate, 'dd/MM/yy') 
                      : 'Até'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={localFilters.endDate}
                    onSelect={(date) => setLocalFilters({ ...localFilters, endDate: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Value Range */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Valor
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Mín"
                value={localFilters.minValue || ''}
                onChange={(e) => setLocalFilters({ 
                  ...localFilters, 
                  minValue: e.target.value ? parseFloat(e.target.value) : undefined 
                })}
              />
              <Input
                type="number"
                placeholder="Máx"
                value={localFilters.maxValue || ''}
                onChange={(e) => setLocalFilters({ 
                  ...localFilters, 
                  maxValue: e.target.value ? parseFloat(e.target.value) : undefined 
                })}
              />
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <User className="h-3 w-3" />
              Destinatário
            </Label>
            <Input
              placeholder="Nome ou CPF/CNPJ"
              value={localFilters.destNome || ''}
              onChange={(e) => setLocalFilters({ ...localFilters, destNome: e.target.value })}
            />
          </div>

          {/* Invoice Number */}
          <div className="space-y-2">
            <Label>Número da NF-e</Label>
            <Input
              placeholder="Ex: 123"
              value={localFilters.numero || ''}
              onChange={(e) => setLocalFilters({ ...localFilters, numero: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleApply}>
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
