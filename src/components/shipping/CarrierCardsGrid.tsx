import { useState, useEffect } from 'react';
import { Settings, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useShippingProviders } from '@/hooks/useShippingProviders';
import { CarrierConfigDialog } from './CarrierConfigDialog';

interface CarrierDefinition {
  id: string;
  name: string;
  logo: string;
  description: string;
}

const CARRIERS: CarrierDefinition[] = [
  {
    id: 'frenet',
    name: 'Frenet',
    logo: '🚀',
    description: 'Gateway de frete com múltiplas transportadoras',
  },
  {
    id: 'correios',
    name: 'Correios',
    logo: '📦',
    description: 'PAC, SEDEX e mais serviços postais',
  },
  {
    id: 'loggi',
    name: 'Loggi',
    logo: '🛵',
    description: 'Entregas urbanas rápidas',
  },
];

export function CarrierCardsGrid() {
  const { providers, isLoading, getProvider } = useShippingProviders();
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleConfigClick = (carrierId: string) => {
    setSelectedCarrier(carrierId);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedCarrier(null);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Integração automática</p>
              <p className="text-muted-foreground">
                Configure as credenciais e o sistema automaticamente calculará fretes
                no checkout. Você pode ativar múltiplas transportadoras simultaneamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Carrier Cards Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {CARRIERS.map((carrier) => {
          const saved = getProvider(carrier.id);
          const isActive = saved?.is_enabled ?? false;
          const isConfigured = !!saved;

          return (
            <Card 
              key={carrier.id} 
              className={`relative transition-all hover:shadow-md ${
                isActive ? 'border-primary/50 bg-primary/5' : ''
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  {/* Logo */}
                  <span className="text-4xl">{carrier.logo}</span>
                  
                  {/* Name and Status */}
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">{carrier.name}</h3>
                    {isActive ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Ativo
                      </Badge>
                    ) : isConfigured ? (
                      <Badge variant="secondary">Configurado</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Não configurado
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {carrier.description}
                  </p>

                  {/* Configure Button */}
                  <Button
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className="w-full gap-2 mt-2"
                    onClick={() => handleConfigClick(carrier.id)}
                  >
                    <Settings className="h-4 w-4" />
                    Configurar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Configuration Dialog */}
      <CarrierConfigDialog
        carrierId={selectedCarrier}
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
      />
    </div>
  );
}