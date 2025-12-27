// =============================================
// CART ITEMS LIST - Displays cart items with quantity controls
// =============================================

import { useCart } from '@/contexts/CartContext';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Trash2 } from 'lucide-react';

export function CartItemsList() {
  const { items, updateQuantity, removeItem } = useCart();
  const { trackAddToCart } = useMarketingEvents();

  // Handle quantity increase with AddToCart tracking
  const handleIncreaseQuantity = (item: typeof items[0]) => {
    updateQuantity(item.id, item.quantity + 1);
    trackAddToCart({
      id: item.product_id,
      name: item.name,
      price: item.price,
      quantity: 1, // Incrementing by 1
    });
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Seu carrinho está vazio</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map(item => (
        <div 
          key={item.id}
          className="flex gap-4 p-4 border rounded-lg"
        >
          {/* Product Image */}
          <div className="w-20 h-20 bg-muted rounded-md overflow-hidden shrink-0">
            {item.image_url ? (
              <img 
                src={item.image_url} 
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                Sem imagem
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium line-clamp-2">{item.name}</h4>
            <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
            <p className="font-semibold mt-1">
              R$ {item.price.toFixed(2).replace('.', ',')}
            </p>
          </div>

          {/* Quantity Controls */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                className="w-14 h-8 text-center"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleIncreaseQuantity(item)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => removeItem(item.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remover
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
