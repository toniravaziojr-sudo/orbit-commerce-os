// =============================================
// FREE SHIPPING SUB-TABS
// Contains sub-tabs for free shipping rules and cart conversion config
// =============================================

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, ShoppingCart } from 'lucide-react';
import { FreeShippingRulesTab } from './FreeShippingRulesTab';
import { CartConversionConfigTab } from './CartConversionConfigTab';

export function FreeShippingSubTabs() {
  const [activeSubTab, setActiveSubTab] = useState('regras');

  return (
    <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
      <TabsList className="mb-6">
        <TabsTrigger value="regras" className="gap-2">
          <MapPin className="h-4 w-4" />
          Regras de Frete Grátis
        </TabsTrigger>
        <TabsTrigger value="conversao" className="gap-2">
          <ShoppingCart className="h-4 w-4" />
          Conversão de Carrinho
        </TabsTrigger>
      </TabsList>

      <TabsContent value="regras">
        <FreeShippingRulesTab />
      </TabsContent>

      <TabsContent value="conversao">
        <CartConversionConfigTab />
      </TabsContent>
    </Tabs>
  );
}
