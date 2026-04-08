import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, ShoppingCart, Truck, RotateCcw, Webhook } from 'lucide-react';
import { TikTokShopCatalogTab } from './TikTokShopCatalogTab';
import { TikTokShopOrdersTab } from './TikTokShopOrdersTab';
import { TikTokShopFulfillmentTab } from './TikTokShopFulfillmentTab';
import { TikTokShopReturnsTab } from './TikTokShopReturnsTab';
import { TikTokShopWebhooksTab } from './TikTokShopWebhooksTab';

export function TikTokShopPanel() {
  return (
    <div className="pt-2">
      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="catalog" className="gap-1 text-[10px]">
            <Package className="h-3 w-3" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1 text-[10px]">
            <ShoppingCart className="h-3 w-3" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="fulfillment" className="gap-1 text-[10px]">
            <Truck className="h-3 w-3" />
            Envios
          </TabsTrigger>
          <TabsTrigger value="returns" className="gap-1 text-[10px]">
            <RotateCcw className="h-3 w-3" />
            Devoluções
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1 text-[10px]">
            <Webhook className="h-3 w-3" />
            Webhooks
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
        <TabsContent value="webhooks" className="mt-4">
          <TikTokShopWebhooksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
