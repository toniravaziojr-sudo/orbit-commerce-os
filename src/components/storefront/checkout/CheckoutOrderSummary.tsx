// =============================================
// CHECKOUT ORDER SUMMARY - Sidebar desktop, collapsible mobile
// =============================================

import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Loader2, ShoppingBag } from 'lucide-react';

type PaymentStatus = 'idle' | 'processing' | 'approved' | 'failed';

interface CheckoutOrderSummaryProps {
  onSubmit: () => void;
  paymentStatus: PaymentStatus;
  discount?: number;
}

export function CheckoutOrderSummary({ onSubmit, paymentStatus, discount = 0 }: CheckoutOrderSummaryProps) {
  const { items, subtotal, shipping, total } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  const finalTotal = total - discount;
  const isProcessing = paymentStatus === 'processing';

  const ItemsList = () => (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.id} className="flex gap-3">
          <div className="w-12 h-12 bg-muted rounded-md overflow-hidden shrink-0">
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                <ShoppingBag className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-1">{item.name}</p>
            <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
          </div>
          <p className="text-sm font-medium">
            R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
          </p>
        </div>
      ))}
    </div>
  );

  const SummaryTotals = () => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal ({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
        <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
      </div>
      
      {shipping.selected && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Frete ({shipping.selected.label})</span>
          <span>
            {shipping.selected.isFree ? (
              <span className="text-green-600">Grátis</span>
            ) : (
              `R$ ${shipping.selected.price.toFixed(2).replace('.', ',')}`
            )}
          </span>
        </div>
      )}

      {discount > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>Desconto</span>
          <span>- R$ {discount.toFixed(2).replace('.', ',')}</span>
        </div>
      )}

      <Separator />

      <div className="flex justify-between font-semibold text-lg">
        <span>Total</span>
        <span>R$ {finalTotal.toFixed(2).replace('.', ',')}</span>
      </div>
    </div>
  );

  // Desktop version - sidebar
  const DesktopSummary = () => (
    <div className="hidden lg:block sticky top-4">
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="font-semibold text-lg mb-4">Resumo do pedido</h3>
        
        <ItemsList />
        
        <Separator className="my-4" />
        
        <SummaryTotals />

        <Button 
          size="lg" 
          className="w-full mt-6"
          onClick={onSubmit}
          disabled={isProcessing || items.length === 0}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            'Finalizar pedido'
          )}
        </Button>
      </div>
    </div>
  );

  // Mobile version - collapsible with always visible total
  const MobileSummary = () => (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              <span className="text-sm font-medium">
                {isOpen ? 'Ocultar resumo' : 'Ver resumo'}
              </span>
            </div>
            <span className="font-semibold">
              R$ {finalTotal.toFixed(2).replace('.', ',')}
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-2 max-h-[40vh] overflow-y-auto">
            <ItemsList />
            <Separator className="my-4" />
            <SummaryTotals />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="p-4 pt-0 pb-safe">
        <Button 
          size="lg" 
          className="w-full"
          onClick={onSubmit}
          disabled={isProcessing || items.length === 0}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            `Finalizar • R$ ${finalTotal.toFixed(2).replace('.', ',')}`
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <DesktopSummary />
      <MobileSummary />
    </>
  );
}
