import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, X } from 'lucide-react';
import { useState } from 'react';

export interface StatusOption {
  value: string;
  label: string;
  color?: string;
}

interface FiscalStatusFilterProps {
  options: StatusOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function FiscalStatusFilter({ options, selected, onChange }: FiscalStatusFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleStatus = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(s => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => {
    onChange([]);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Status
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filtrar por Status</span>
            {selected.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAll}>
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5"
              >
                <Checkbox
                  checked={selected.includes(option.value)}
                  onCheckedChange={() => toggleStatus(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Status options for "Pedidos em Aberto" tab (draft invoices, filter by order context)
export const orderStatusOptions: StatusOption[] = [
  { value: 'ready', label: 'Pronta para emitir' },
  { value: 'chargeback', label: 'Chargeback em andamento' },
  { value: 'cancelled', label: 'Venda cancelada' },
];

// Status options for "Notas Fiscais" tab (non-draft invoices)
export const invoiceStatusOptions: StatusOption[] = [
  { value: 'authorized', label: 'Autorizada' },
  { value: 'printed', label: 'Impressa' },
  { value: 'pending', label: 'Pendente SEFAZ' },
  { value: 'rejected', label: 'Rejeitada' },
  { value: 'canceled', label: 'Cancelada' },
];
