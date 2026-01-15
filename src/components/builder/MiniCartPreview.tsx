// =============================================
// MINI CART PREVIEW - Preview-only overlay for builder canvas
// Shows mock data without CartContext dependency
// Renders as an overlay inside the builder canvas (not a global Sheet)
// =============================================

import { Button } from '@/components/ui/button';
import { ShoppingCart, Truck, Check, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface MiniCartPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewport?: 'desktop' | 'mobile';
}

// Mock cart item for preview
const MOCK_ITEMS = [
  {
    id: '1',
    name: 'Produto Exemplo',
    price: 149.90,
    quantity: 2,
    image_url: null,
  },
  {
    id: '2',
    name: 'Outro Produto de Exemplo',
    price: 89.90,
    quantity: 1,
    image_url: null,
  },
];

export function MiniCartPreview({ 
  open, 
  onOpenChange,
  viewport = 'desktop',
}: MiniCartPreviewProps) {
  const subtotal = MOCK_ITEMS.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = 15.90;
  const total = subtotal + shipping;

  if (!open) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/40 z-40 transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Drawer panel - slides in from right, inside the canvas */}
      <div 
        className={cn(
          "absolute top-0 right-0 h-full bg-background border-l shadow-xl z-50 flex flex-col transition-transform duration-300",
          viewport === 'mobile' ? 'w-full' : 'w-[380px] max-w-[90%]'
        )}
      >
        {/* Header */}
        <div className="border-b px-4 py-4 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <span className="text-base font-semibold">Carrinho</span>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Benefit Progress Bar Preview */}
          <div className="p-3 rounded-lg border bg-muted/50 text-sm mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-full bg-muted-foreground/20">
                <Truck className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="flex-1 text-xs">
                <p>
                  Faltam <span className="font-semibold">R$ 50,20</span> para frete grátis
                </p>
              </div>
            </div>
            <Progress value={75} className="h-1.5" />
          </div>

          {/* Mock Cart Items */}
          <div className="space-y-4">
            {MOCK_ITEMS.map((item) => (
              <div key={item.id} className="flex gap-3 py-2">
                {/* Image placeholder */}
                <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 opacity-30" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-semibold">
                      R$ {item.price.toFixed(2).replace('.', ',')}
                    </p>
                    <div className="flex items-center gap-2 border rounded-full px-2 py-0.5">
                      <button className="text-muted-foreground hover:text-foreground p-0.5">−</button>
                      <span className="text-sm w-6 text-center">{item.quantity}</span>
                      <button className="text-muted-foreground hover:text-foreground p-0.5">+</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Shipping Preview */}
          <div className="border rounded-lg p-3 mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span>Calcular frete</span>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 flex items-center gap-1">
              <Check className="h-3 w-3 text-green-600" />
              <span>PAC • 5 dia(s) • R$ 15,90</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-4 space-y-4 bg-background flex-shrink-0">
          {/* Summary */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between">
              <span>Frete:</span>
              <span className="font-medium">R$ {shipping.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t">
              <span>Total:</span>
              <span>R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-2">
            <Button 
              className="w-full h-12 rounded-full font-semibold uppercase tracking-wide text-sm"
              onClick={() => onOpenChange(false)}
            >
              Iniciar Compra
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 rounded-full font-semibold uppercase tracking-wide text-sm"
              onClick={() => onOpenChange(false)}
            >
              Ir para o Carrinho
            </Button>
            <Button
              variant="ghost"
              className="w-full h-10 rounded-full font-semibold uppercase tracking-wide text-xs"
              onClick={() => onOpenChange(false)}
            >
              Continuar Comprando
            </Button>
          </div>
        </div>

        {/* Preview indicator */}
        <div className="absolute bottom-2 left-2 bg-yellow-100 border border-yellow-300 text-yellow-800 text-[10px] px-2 py-0.5 rounded">
          Visualização de exemplo
        </div>
      </div>
    </>
  );
}
