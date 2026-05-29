// =============================================
// SHIPPING SETTINGS TAB — em Configurações do Sistema
// Sub-abas:
//   - Regras de Frete Grátis (Método Padrão + Regras)
//   - Frete Personalizado
// =============================================
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, DollarSign } from 'lucide-react';
import { DefaultFreeShippingMethodConfig } from '@/components/shipping/DefaultFreeShippingMethodConfig';
import { FreeShippingRulesTab } from '@/components/shipping/FreeShippingRulesTab';
import { CustomShippingRulesTab } from '@/components/shipping/CustomShippingRulesTab';

type ShippingSubTab = 'regras-frete-gratis' | 'frete-personalizado';

export function ShippingSettingsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const subFromUrl = searchParams.get('aba') as ShippingSubTab | null;
  const activeSub: ShippingSubTab =
    subFromUrl === 'frete-personalizado' ? 'frete-personalizado' : 'regras-frete-gratis';

  const handleSubChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'shipping');
    next.set('aba', value);
    setSearchParams(next);
  };

  return (
    <Tabs value={activeSub} onValueChange={handleSubChange} className="space-y-6">
      <TabsList className="w-auto inline-flex">
        <TabsTrigger value="regras-frete-gratis" className="gap-2">
          <Gift className="h-4 w-4" />
          Regras de Frete Grátis
        </TabsTrigger>
        <TabsTrigger value="frete-personalizado" className="gap-2">
          <DollarSign className="h-4 w-4" />
          Frete Personalizado
        </TabsTrigger>
      </TabsList>

      <TabsContent value="regras-frete-gratis" className="space-y-6">
        <DefaultFreeShippingMethodConfig />
        <FreeShippingRulesTab />
      </TabsContent>

      <TabsContent value="frete-personalizado" className="space-y-6">
        <CustomShippingRulesTab />
      </TabsContent>
    </Tabs>
  );
}
