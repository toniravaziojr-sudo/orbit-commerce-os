/**
 * Estimativa de Custo para Geração de Imagens
 * Mostra custo baseado em provedores e variações
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageProvider } from './types';

interface CostEstimateProps {
  providers: ImageProvider[];
  variations: number;
}

// Custos base por provedor (em centavos BRL)
const PROVIDER_COSTS = {
  openai: 25, // R$ 0,25 por imagem
  gemini: 15, // R$ 0,15 por imagem
};

const QA_COST = 5; // R$ 0,05 por QA

export function CostEstimate({ providers, variations }: CostEstimateProps) {
  // Calcular custo total
  const providerCosts = providers.map(p => ({
    provider: p,
    cost: PROVIDER_COSTS[p] * variations,
  }));
  
  const totalProviderCost = providerCosts.reduce((sum, pc) => sum + pc.cost, 0);
  const totalQACost = providers.length > 1 ? QA_COST * variations * 2 : QA_COST * variations;
  const totalCost = totalProviderCost + totalQACost;

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <Card className="border-dashed bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium">Estimativa de Custo</span>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[280px]">
                <div className="space-y-2 text-xs">
                  <p className="font-medium">Detalhamento:</p>
                  {providerCosts.map(pc => (
                    <div key={pc.provider} className="flex justify-between">
                      <span>{pc.provider === 'openai' ? 'OpenAI' : 'Gemini'} ({variations} imgs):</span>
                      <span>{formatCurrency(pc.cost)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-1">
                    <span>QA + Scoring:</span>
                    <span>{formatCurrency(totalQACost)}</span>
                  </div>
                  {providers.length === 2 && (
                    <p className="text-muted-foreground pt-1">
                      Com 2 provedores, ambos geram e o melhor é selecionado.
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {formatCurrency(totalCost)}
            </Badge>
            {providers.length === 2 && (
              <Badge variant="outline" className="text-[10px]">
                2 provedores
              </Badge>
            )}
          </div>
        </div>

        {providers.length === 0 && (
          <p className="text-xs text-destructive mt-2">
            Selecione ao menos um provedor.
          </p>
        )}

        {providers.length === 2 && (
          <p className="text-xs text-muted-foreground mt-2">
            💡 Ambos geram, o mais <strong>realista</strong> é selecionado automaticamente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
