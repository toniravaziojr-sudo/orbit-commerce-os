import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSupportedPlatforms } from '@/lib/import/platforms';

interface PlatformSelectorProps {
  selected: string | null;
  onSelect: (platform: string) => void;
}

const platformLogos: Record<string, string> = {
  shopify: '🛒',
  nuvemshop: '☁️',
  tray: '📦',
  woocommerce: '🔧',
  bagy: '🛍️',
  yampi: '🎯',
  loja_integrada: '🔗',
  wix: '✨',
};

export function PlatformSelector({ selected, onSelect }: PlatformSelectorProps) {
  const platforms = getSupportedPlatforms();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Selecione a plataforma de origem</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {platforms.map((platform) => (
          <Card
            key={platform.id}
            className={cn(
              'cursor-pointer transition-all hover:border-primary',
              selected === platform.id && 'border-primary bg-primary/5'
            )}
            onClick={() => onSelect(platform.id)}
          >
            <CardContent className="flex flex-col items-center justify-center p-6">
              <span className="text-4xl mb-2">{platformLogos[platform.id] || '📦'}</span>
              <span className="font-medium text-center">{platform.name}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
