import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ShipmentRecord {
  id: string;
  carrier: string | null;
  delivery_status: string;
}

interface SuccessRatePopoverProps {
  shipments: ShipmentRecord[];
  children: React.ReactNode;
}

export function SuccessRatePopover({ shipments, children }: SuccessRatePopoverProps) {
  const ratesByCarrier = useMemo(() => {
    const carriers = ['Correios', 'Loggi', 'Frenet', 'Outros'];
    
    return carriers.map(carrier => {
      let filtered: ShipmentRecord[];
      
      if (carrier === 'Outros') {
        filtered = shipments.filter(s => 
          s.carrier && !['correios', 'loggi', 'frenet'].includes(s.carrier.toLowerCase())
        );
      } else {
        filtered = shipments.filter(s => 
          s.carrier?.toLowerCase() === carrier.toLowerCase()
        );
      }

      const total = filtered.length;
      const delivered = filtered.filter(s => s.delivery_status === 'delivered').length;
      const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;

      return {
        carrier,
        total,
        delivered,
        rate,
      };
    }).filter(c => c.total > 0);
  }, [shipments]);

  const overallRate = useMemo(() => {
    const total = shipments.length;
    const delivered = shipments.filter(s => s.delivery_status === 'delivered').length;
    return total > 0 ? Math.round((delivered / total) * 100) : 0;
  }, [shipments]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-64" align="center">
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="font-medium">Taxa de Sucesso</span>
          </div>

          {ratesByCarrier.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Sem dados disponíveis
            </p>
          ) : (
            <div className="space-y-2">
              {ratesByCarrier.map(item => (
                <div key={item.carrier} className="flex items-center justify-between">
                  <span className="text-sm">{item.carrier}</span>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={item.rate >= 90 ? 'default' : item.rate >= 70 ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {item.rate}%
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({item.delivered}/{item.total})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Geral</span>
              <Badge variant="outline" className="text-xs">
                {overallRate}%
              </Badge>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
