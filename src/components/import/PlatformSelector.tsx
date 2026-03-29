import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface PlatformSelectorProps {
  selected: string | null;
  onSelect: (platform: string) => void;
  detectedPlatform?: string | null;
}

// Plataformas suportadas com logo/emoji e descrição
const PLATFORMS = [
  { id: 'shopify', name: 'Shopify', emoji: '🛒', description: 'Lojas .myshopify.com' },
  { id: 'nuvemshop', name: 'Nuvemshop', emoji: '☁️', description: 'Tiendanube / Nuvemshop' },
  { id: 'tray', name: 'Tray', emoji: '📦', description: 'Tray Commerce' },
  { id: 'woocommerce', name: 'WooCommerce', emoji: '🔧', description: 'WordPress + WooCommerce' },
  { id: 'bagy', name: 'Bagy', emoji: '🛍️', description: 'Plataforma Bagy' },
  { id: 'yampi', name: 'Yampi', emoji: '🎯', description: 'Checkout e loja Yampi' },
  { id: 'loja_integrada', name: 'Loja Integrada', emoji: '🔗', description: 'Loja Integrada' },
  { id: 'wix', name: 'Wix', emoji: '✨', description: 'Wix E-commerce' },
  { id: 'vtex', name: 'VTEX', emoji: '🏢', description: 'VTEX Commerce' },
  { id: 'magento', name: 'Magento', emoji: '🧲', description: 'Adobe Commerce / Magento' },
  { id: 'opencart', name: 'OpenCart', emoji: '🛒', description: 'OpenCart' },
  { id: 'prestashop', name: 'PrestaShop', emoji: '🏪', description: 'PrestaShop' },
];

export function PlatformSelector({ selected, onSelect, detectedPlatform }: PlatformSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Selecione a plataforma de origem</h3>
      {detectedPlatform && (
        <p className="text-sm text-muted-foreground">
          Plataforma detectada automaticamente: <strong>{detectedPlatform}</strong>
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PLATFORMS.map((platform) => {
          const isDetected = detectedPlatform?.toLowerCase() === platform.id || 
                             detectedPlatform?.toLowerCase().replace(' ', '_') === platform.id;
          const isSelected = selected === platform.id;

          return (
            <Card
              key={platform.id}
              className={cn(
                'cursor-pointer transition-all hover:border-primary relative',
                isSelected && 'border-primary bg-primary/5 ring-2 ring-primary',
                isDetected && !isSelected && 'border-green-500/50 bg-green-500/5'
              )}
              onClick={() => onSelect(platform.id)}
            >
              {isDetected && (
                <Badge 
                  className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] px-1.5"
                >
                  Detectada
                </Badge>
              )}
              <CardContent className="flex flex-col items-center justify-center p-4">
                <span className="text-3xl mb-2">{platform.emoji}</span>
                <span className="font-medium text-center text-sm">{platform.name}</span>
                <span className="text-xs text-muted-foreground text-center mt-1">{platform.description}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Exportar lista de plataformas para uso em outros lugares
export function getSupportedPlatforms() {
  return PLATFORMS.map(p => ({ id: p.id, name: p.name }));
}