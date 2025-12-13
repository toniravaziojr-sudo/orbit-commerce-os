import { Link, useParams } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';

export default function StorefrontCart() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { storeSettings } = usePublicStorefront(tenantSlug || '');
  const { items, updateQuantity, removeItem, subtotal } = useCart(tenantSlug || '');

  const baseUrl = `/store/${tenantSlug}`;
  const primaryColor = storeSettings?.primary_color || '#6366f1';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Carrinho vazio</h1>
          <p className="text-gray-600 mb-6">
            Você ainda não adicionou nenhum produto ao carrinho.
          </p>
          <Link to={baseUrl}>
            <Button style={{ backgroundColor: primaryColor }} className="text-white">
              Continuar Comprando
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Carrinho de Compras</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        Sem imagem
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 line-clamp-2">{item.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">SKU: {item.sku}</p>
                    <p
                      className="text-lg font-bold mt-2"
                      style={{ color: primaryColor }}
                    >
                      {formatCurrency(item.price)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-red-500"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center border rounded-lg">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Frete</span>
                <span className="text-gray-500">Calculado no checkout</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span
                    className="text-xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {formatCurrency(subtotal)}
                  </span>
                </div>
              </div>

              <Link to={`${baseUrl}/checkout`} className="block">
                <Button
                  className="w-full text-white"
                  size="lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  Finalizar Compra
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              <Link to={baseUrl} className="block">
                <Button variant="outline" className="w-full">
                  Continuar Comprando
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
