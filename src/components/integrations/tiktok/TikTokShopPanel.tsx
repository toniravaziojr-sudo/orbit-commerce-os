// =============================================
// TIKTOK SHOP PANEL
// Tabbed panel for TikTok Shop operations
// Shown inside TikTokUnifiedSettings when Shop is connected
// =============================================

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, ShoppingCart, Truck, RotateCcw } from 'lucide-react';
import { TikTokShopCatalogTab } from './TikTokShopCatalogTab';
import { TikTokShopOrdersTab } from './TikTokShopOrdersTab';
import { TikTokShopFulfillmentTab } from './TikTokShopFulfillmentTab';
import { TikTokShopReturnsTab } from './TikTokShopReturnsTab';

export function TikTokShopPanel() {
  return (
    <div className="pt-2">
      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="catalog" className="gap-1.5 text-xs">
            <Package className="h-3.5 w-3.5" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5 text-xs">
            <ShoppingCart className="h-3.5 w-3.5" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="fulfillment" className="gap-1.5 text-xs">
            <Truck className="h-3.5 w-3.5" />
            Envios
          </TabsTrigger>
          <TabsTrigger value="returns" className="gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Devoluções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          <TikTokShopCatalogTab />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <TikTokShopOrdersTab />
        </TabsContent>
        <TabsContent value="fulfillment" className="mt-4">
          <TikTokShopFulfillmentTab />
        </TabsContent>
        <TabsContent value="returns" className="mt-4">
          <TikTokShopReturnsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
