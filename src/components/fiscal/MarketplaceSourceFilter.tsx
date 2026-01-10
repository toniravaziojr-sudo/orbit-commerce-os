import { Store, ShoppingBag } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Ícone SVG do Mercado Livre
const MercadoLivreIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
  >
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4c5.302 0 9.6 4.298 9.6 9.6s-4.298 9.6-9.6 9.6S2.4 17.302 2.4 12 6.698 2.4 12 2.4zm0 2.4c-3.976 0-7.2 3.224-7.2 7.2s3.224 7.2 7.2 7.2 7.2-3.224 7.2-7.2-3.224-7.2-7.2-7.2z" />
  </svg>
);

interface MarketplaceSourceFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function MarketplaceSourceFilter({ value, onChange }: MarketplaceSourceFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Todas as origens" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            <span>Todas as origens</span>
          </div>
        </SelectItem>
        <SelectItem value="loja">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <span>Loja Própria</span>
          </div>
        </SelectItem>
        <SelectItem value="mercadolivre">
          <div className="flex items-center gap-2">
            <MercadoLivreIcon className="h-4 w-4 text-yellow-600" />
            <span>Mercado Livre</span>
          </div>
        </SelectItem>
        <SelectItem value="shopee">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-orange-600" />
            <span>Shopee</span>
          </div>
        </SelectItem>
        <SelectItem value="amazon">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-orange-500" />
            <span>Amazon</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
