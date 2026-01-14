// =============================================
// CART AND CHECKOUT - Unified settings page
// =============================================

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { CartConfigTab } from '@/components/cart-checkout/CartConfigTab';
import { CheckoutConfigTab } from '@/components/cart-checkout/CheckoutConfigTab';
import { AbandonedCheckoutsTab } from '@/components/cart-checkout/AbandonedCheckoutsTab';
import { ShoppingCart, CreditCard, ShoppingBag } from 'lucide-react';

export default function CartAndCheckout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'cart');

  useEffect(() => {
    if (tabFromUrl && ['cart', 'checkout', 'abandoned'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Carrinho e Checkout"
        description="Configure as funcionalidades do carrinho e checkout da sua loja"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="cart" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Carrinho</span>
          </TabsTrigger>
          <TabsTrigger value="checkout" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Checkout</span>
          </TabsTrigger>
          <TabsTrigger value="abandoned" className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Checkout Abandonado</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cart" className="mt-6">
          <CartConfigTab />
        </TabsContent>

        <TabsContent value="checkout" className="mt-6">
          <CheckoutConfigTab />
        </TabsContent>

        <TabsContent value="abandoned" className="mt-6">
          <AbandonedCheckoutsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
