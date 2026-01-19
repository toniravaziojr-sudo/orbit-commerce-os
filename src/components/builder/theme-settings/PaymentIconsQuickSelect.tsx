// =============================================
// PAYMENT ICONS QUICK SELECT - Pre-defined payment icons for one-click add
// =============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaymentIconOption {
  id: string;
  name: string;
  svg: string;
}

// Payment icons with inline SVGs as data URIs
export const PAYMENT_ICONS: PaymentIconOption[] = [
  {
    id: 'visa',
    name: 'Visa',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#1A1F71"/><path d="M19.5 21.5h-3l1.875-11.5h3L19.5 21.5zm8.25-11.25c-.594-.219-1.5-.469-2.625-.469-2.906 0-4.969 1.5-4.969 3.656 0 1.594 1.469 2.469 2.594 3 1.156.531 1.531.906 1.531 1.375 0 .75-.938 1.094-1.781 1.094-1.187 0-1.812-.156-2.781-.563l-.406-.188-.406 2.5c.688.313 1.969.594 3.281.594 3.094 0 5.094-1.5 5.094-3.781 0-1.25-.781-2.219-2.469-3-.031-.031-1.5-.75-1.5-1.5 0-.469.5-.969 1.5-.969.875 0 1.531.188 2.031.406l.25.125.375-2.281zm7.406-.25h-2.25c-.719 0-1.25.188-1.563.906l-4.406 10.594h3.094s.5-1.406.625-1.719h3.781c.094.406.375 1.719.375 1.719h2.75l-2.406-11.5zm-3.344 7.5c.25-.656 1.188-3.156 1.188-3.156s.25-.656.406-1.063l.188.969.719 3.25h-2.5zM15 10l-2.875 7.875-.313-1.5c-.531-1.75-2.188-3.656-4.031-4.594l2.625 9.719h3.125L18.125 10H15z" fill="white"/></svg>`)}`
  },
  {
    id: 'mastercard',
    name: 'Mastercard',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#F5F5F5"/><circle cx="19" cy="16" r="9" fill="#EB001B"/><circle cx="29" cy="16" r="9" fill="#F79E1B"/><path d="M24 9.3a9 9 0 0 0 0 13.4 9 9 0 0 0 0-13.4z" fill="#FF5F00"/></svg>`)}`
  },
  {
    id: 'elo',
    name: 'Elo',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#000"/><path d="M12 14c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z" fill="#FFCB05"/><path d="M18 18c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z" fill="#00A4E0"/><path d="M24 14c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z" fill="#EF4123"/><text x="24" y="26" text-anchor="middle" fill="white" font-size="8" font-family="Arial" font-weight="bold">elo</text></svg>`)}`
  },
  {
    id: 'amex',
    name: 'American Express',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#006FCF"/><text x="24" y="18" text-anchor="middle" fill="white" font-size="10" font-family="Arial" font-weight="bold">AMEX</text></svg>`)}`
  },
  {
    id: 'hipercard',
    name: 'Hipercard',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#822124"/><text x="24" y="18" text-anchor="middle" fill="white" font-size="8" font-family="Arial" font-weight="bold">HIPERCARD</text></svg>`)}`
  },
  {
    id: 'pix',
    name: 'PIX',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#32BCAD"/><path d="M28.2 11.8l-4.2 4.2-4.2-4.2-2.1 2.1 4.2 4.2-4.2 4.2 2.1 2.1 4.2-4.2 4.2 4.2 2.1-2.1-4.2-4.2 4.2-4.2-2.1-2.1z" fill="white"/></svg>`)}`
  },
  {
    id: 'boleto',
    name: 'Boleto',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#333"/><rect x="10" y="8" width="2" height="16" fill="white"/><rect x="14" y="8" width="1" height="16" fill="white"/><rect x="17" y="8" width="3" height="16" fill="white"/><rect x="22" y="8" width="1" height="16" fill="white"/><rect x="25" y="8" width="2" height="16" fill="white"/><rect x="29" y="8" width="1" height="16" fill="white"/><rect x="32" y="8" width="3" height="16" fill="white"/><rect x="37" y="8" width="1" height="16" fill="white"/></svg>`)}`
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#00B1EA"/><circle cx="24" cy="14" r="6" fill="white"/><path d="M21 13c.5-1.5 2-2 3-2s2.5.5 3 2M24 12v4M22 15h4" stroke="#00B1EA" stroke-width="1.2"/><text x="24" y="26" text-anchor="middle" fill="white" font-size="5" font-family="Arial" font-weight="bold">MERCADO PAGO</text></svg>`)}`
  },
  {
    id: 'paypal',
    name: 'PayPal',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#003087"/><text x="24" y="18" text-anchor="middle" fill="white" font-size="9" font-family="Arial" font-weight="bold">PayPal</text></svg>`)}`
  },
  {
    id: 'nubank',
    name: 'Nubank',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#820AD1"/><text x="24" y="18" text-anchor="middle" fill="white" font-size="9" font-family="Arial" font-weight="bold">Nu</text></svg>`)}`
  },
  {
    id: 'picpay',
    name: 'PicPay',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#21C25E"/><text x="24" y="18" text-anchor="middle" fill="white" font-size="8" font-family="Arial" font-weight="bold">PicPay</text></svg>`)}`
  },
  {
    id: 'dinersclub',
    name: 'Diners Club',
    svg: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#0079BE"/><circle cx="24" cy="16" r="8" fill="white"/><path d="M20 12v8M28 12v8" stroke="#0079BE" stroke-width="2"/></svg>`)}`
  },
];

interface PaymentIconsQuickSelectProps {
  onAddIcons: (icons: { imageUrl: string; linkUrl: string }[]) => void;
  existingUrls?: string[];
}

export function PaymentIconsQuickSelect({ onAddIcons, existingUrls = [] }: PaymentIconsQuickSelectProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);

  const toggleIcon = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleAddSelected = () => {
    const iconsToAdd = PAYMENT_ICONS
      .filter(icon => selectedIds.has(icon.id))
      .map(icon => ({ imageUrl: icon.svg, linkUrl: '' }));
    
    if (iconsToAdd.length > 0) {
      onAddIcons(iconsToAdd);
      setSelectedIds(new Set());
      setShowPicker(false);
    }
  };

  const handleAddAll = () => {
    const allIcons = PAYMENT_ICONS.map(icon => ({ imageUrl: icon.svg, linkUrl: '' }));
    onAddIcons(allIcons);
    setShowPicker(false);
  };

  // Check if an icon is already added
  const isIconAdded = (icon: PaymentIconOption) => {
    return existingUrls.some(url => url === icon.svg);
  };

  if (!showPicker) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 h-8 text-xs border-dashed"
        onClick={() => setShowPicker(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Seleção Rápida de Bandeiras
      </Button>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Selecione as bandeiras</Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() => setShowPicker(false)}
        >
          Cancelar
        </Button>
      </div>

      {/* Icons grid */}
      <div className="grid grid-cols-4 gap-2">
        {PAYMENT_ICONS.map((icon) => {
          const isSelected = selectedIds.has(icon.id);
          const alreadyAdded = isIconAdded(icon);

          return (
            <button
              key={icon.id}
              type="button"
              disabled={alreadyAdded}
              onClick={() => toggleIcon(icon.id)}
              className={cn(
                "relative flex flex-col items-center gap-1 p-2 rounded-md border transition-all",
                alreadyAdded 
                  ? "opacity-40 cursor-not-allowed bg-muted" 
                  : isSelected 
                    ? "border-primary bg-primary/10 ring-1 ring-primary" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              {isSelected && (
                <div className="absolute -top-1.5 -right-1.5 bg-primary rounded-full p-0.5">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
              <img 
                src={icon.svg} 
                alt={icon.name}
                className="h-6 w-auto object-contain"
              />
              <span className="text-[9px] text-muted-foreground truncate max-w-full">
                {icon.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={handleAddAll}
        >
          Adicionar Todas
        </Button>
        <Button
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={handleAddSelected}
          disabled={selectedIds.size === 0}
        >
          Adicionar {selectedIds.size > 0 ? `(${selectedIds.size})` : 'Selecionadas'}
        </Button>
      </div>
    </div>
  );
}
