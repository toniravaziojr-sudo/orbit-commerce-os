import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Trash2, Minus, Plus, ArrowLeft } from "lucide-react";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";

interface CartItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
}

export default function CartPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const cartKey = `cart_${tenantSlug}`;

  useEffect(() => {
    const fetchTenant = async () => {
      if (!tenantSlug) return;

      const { data } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("slug", tenantSlug)
        .single();

      if (data) {
        setTenant(data);
      }
      setLoading(false);
    };

    fetchTenant();
  }, [tenantSlug]);

  useEffect(() => {
    const savedCart = localStorage.getItem(cartKey);
    if (savedCart) {
      try {
        const cart = JSON.parse(savedCart);
        setItems(cart.items || []);
      } catch {
        setItems([]);
      }
    }
  }, [cartKey]);

  const updateCart = (newItems: CartItem[]) => {
    setItems(newItems);
    localStorage.setItem(cartKey, JSON.stringify({ items: newItems }));
  };

  const updateQuantity = (productId: string, delta: number) => {
    const newItems = items
      .map((item) => {
        if (item.productId === productId) {
          const newQuantity = item.quantity + delta;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
        }
        return item;
      })
      .filter((item): item is CartItem => item !== null);
    updateCart(newItems);
  };

  const removeItem = (productId: string) => {
    const newItems = items.filter((item) => item.productId !== productId);
    updateCart(newItems);
  };

  const clearCart = () => {
    updateCart([]);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16 border-b">
          <Skeleton className="h-full" />
        </div>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Loja não encontrada</h1>
          <Button asChild>
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StoreHeader
        storeName={tenant.name}
        cartItemCount={items.length}
        onCartClick={() => {}}
      />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to={`/store/${tenantSlug}`}>
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">Carrinho de Compras</h1>
            </div>
            {items.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart}>
                Limpar carrinho
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Seu carrinho está vazio
              </h2>
              <p className="text-muted-foreground mb-6">
                Adicione produtos para continuar comprando
              </p>
              <Button asChild>
                <Link to={`/store/${tenantSlug}`}>Continuar Comprando</Link>
              </Button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Lista de itens */}
              <div className="lg:col-span-2 space-y-4">
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex gap-4 p-4 bg-card rounded-lg border"
                  >
                    <div className="h-24 w-24 rounded-md bg-muted overflow-hidden flex-shrink-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                          Sem imagem
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium mb-1">{item.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {formatPrice(item.price)} cada
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.productId, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.productId, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-semibold">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeItem(item.productId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumo */}
              <div className="lg:col-span-1">
                <div className="bg-card rounded-lg border p-6 sticky top-24">
                  <h2 className="font-semibold text-lg mb-4">Resumo do Pedido</h2>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Subtotal ({items.length} itens)
                      </span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete</span>
                      <span className="text-muted-foreground">
                        Calculado no checkout
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between font-semibold text-lg mb-6 pt-4 border-t">
                    <span>Total</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => navigate(`/store/${tenantSlug}/checkout`)}
                  >
                    Finalizar Compra
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full mt-3"
                    asChild
                  >
                    <Link to={`/store/${tenantSlug}`}>Continuar Comprando</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <StoreFooter storeName={tenant.name} />
    </div>
  );
}
