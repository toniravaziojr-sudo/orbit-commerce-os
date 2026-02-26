import { Store, ShoppingBag } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Ícone SVG do Mercado Livre
const MercadoLivreIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
  >
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4c5.302 0 9.6 4.298 9.6 9.6s-4.298 9.6-9.6 9.6S2.4 17.302 2.4 12 6.698 2.4 12 2.4zm0 2.4c-3.976 0-7.2 3.224-7.2 7.2s3.224 7.2 7.2 7.2 7.2-3.224 7.2-7.2-3.224-7.2-7.2-7.2zm-3.6 4.8c.662 0 1.2.538 1.2 1.2v2.4c0 .662-.538 1.2-1.2 1.2s-1.2-.538-1.2-1.2v-2.4c0-.662.538-1.2 1.2-1.2zm7.2 0c.662 0 1.2.538 1.2 1.2v2.4c0 .662-.538 1.2-1.2 1.2s-1.2-.538-1.2-1.2v-2.4c0-.662.538-1.2 1.2-1.2zm-3.6 1.2c.993 0 1.8.807 1.8 1.8s-.807 1.8-1.8 1.8-1.8-.807-1.8-1.8.807-1.8 1.8-1.8z" />
  </svg>
);

// Mapa de marketplaces com suas configurações
const marketplaceConfig: Record<string, { 
  name: string; 
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}> = {
  mercadolivre: {
    name: 'Mercado Livre',
    icon: MercadoLivreIcon,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  shopee: {
    name: 'Shopee',
    icon: ShoppingBag,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  tiktokshop: {
    name: 'TikTok Shop',
    icon: ShoppingBag,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
  },
  amazon: {
    name: 'Amazon',
    icon: ShoppingBag,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100',
  },
  magazineluiza: {
    name: 'Magazine Luiza',
    icon: ShoppingBag,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
};

interface OrderSourceBadgeProps {
  marketplaceSource?: string | null;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function OrderSourceBadge({ 
  marketplaceSource, 
  showLabel = false,
  size = 'md' 
}: OrderSourceBadgeProps) {
  // Se não tem marketplace_source, é pedido da loja própria
  if (!marketplaceSource) {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    };

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5">
            <div className={`rounded-full bg-primary/10 p-1 ${size === 'sm' ? 'p-0.5' : 'p-1'}`}>
              <Store className={`${sizeClasses[size]} text-primary`} />
            </div>
            {showLabel && <span className="text-sm text-muted-foreground">Loja</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs font-medium">Loja Própria</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Busca configuração do marketplace
  const config = marketplaceConfig[marketplaceSource.toLowerCase()];
  
  if (!config) {
    // Marketplace desconhecido
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5">
            <div className="rounded-full bg-gray-100 p-1">
              <ShoppingBag className="h-5 w-5 text-gray-600" />
            </div>
            {showLabel && <span className="text-sm text-muted-foreground">{marketplaceSource}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs font-medium">{marketplaceSource}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const Icon = config.icon;
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center gap-1.5">
          <div className={`rounded-full ${config.bgColor} ${size === 'sm' ? 'p-0.5' : 'p-1'}`}>
            <Icon className={`${sizeClasses[size]} ${config.color}`} />
          </div>
          {showLabel && <span className="text-sm text-muted-foreground">{config.name}</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs font-medium">{config.name}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Export para uso em filtros
export const MARKETPLACE_OPTIONS = [
  { value: '', label: 'Todas as origens' },
  { value: 'loja', label: 'Loja Própria' },
  { value: 'mercadolivre', label: 'Mercado Livre' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'tiktokshop', label: 'TikTok Shop' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'magazineluiza', label: 'Magazine Luiza' },
];
