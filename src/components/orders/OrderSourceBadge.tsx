import { Store, ShoppingBag, Bot } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import mercadoLivreLogo from '@/assets/marketplaces/mercadolivre.png';

// Logo oficial do Mercado Livre (handshake amarelo).
const MercadoLivreIcon = ({ className }: { className?: string }) => (
  <img
    src={mercadoLivreLogo}
    alt="Mercado Livre"
    loading="lazy"
    className={`${className ?? ''} object-contain`}
  />
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
  salesChannel?: string | null;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function OrderSourceBadge({ 
  marketplaceSource, 
  salesChannel,
  showLabel = false,
  size = 'md' 
}: OrderSourceBadgeProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  // Venda IA tem prioridade sobre "loja própria" — pedido fechado via IA de Atendimento (WhatsApp)
  if (!marketplaceSource && salesChannel === 'ai_attendant') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5">
            <div className={`rounded-full bg-primary/15 ${size === 'sm' ? 'p-0.5' : 'p-1'}`}>
              <Bot className={`${sizeClasses[size]} text-primary`} />
            </div>
            {showLabel && <span className="text-sm text-muted-foreground">Venda IA</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs font-medium">Venda IA — fechada pela IA de Atendimento</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Se não tem marketplace_source, é pedido da loja própria
  if (!marketplaceSource) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5">
            <div className={`rounded-full bg-primary/10 ${size === 'sm' ? 'p-0.5' : 'p-1'}`}>
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
  { value: 'venda_ia', label: 'Venda IA' },
  { value: 'mercadolivre', label: 'Mercado Livre' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'tiktokshop', label: 'TikTok Shop' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'magazineluiza', label: 'Magazine Luiza' },
];