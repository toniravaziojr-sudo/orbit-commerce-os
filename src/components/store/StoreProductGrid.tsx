import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Eye } from "lucide-react";
import { toast } from "sonner";
import { ProductDetailModal } from "./ProductDetailModal";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  short_description: string | null;
  stock_quantity: number;
  status: string;
  images: { url: string; alt_text: string | null; is_primary: boolean }[];
}

interface StoreProductGridProps {
  tenantId: string;
  tenantSlug: string;
  onAddToCart: (count: number) => void;
}

export function StoreProductGrid({
  tenantId,
  tenantSlug,
  onAddToCart,
}: StoreProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          slug,
          price,
          compare_at_price,
          short_description,
          stock_quantity,
          status,
          product_images (url, alt_text, is_primary)
        `)
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching products:", error);
      } else {
        const formattedProducts = data.map((product) => ({
          ...product,
          images: product.product_images || [],
        }));
        setProducts(formattedProducts);
      }
      setLoading(false);
    };

    fetchProducts();
  }, [tenantId]);

  const addToCart = (product: Product) => {
    const cartKey = `cart_${tenantSlug}`;
    const savedCart = localStorage.getItem(cartKey);
    let cart = savedCart ? JSON.parse(savedCart) : { items: [] };

    const existingIndex = cart.items.findIndex(
      (item: any) => item.productId === product.id
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += 1;
    } else {
      cart.items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.images.find((img) => img.is_primary)?.url || product.images[0]?.url,
        quantity: 1,
      });
    }

    localStorage.setItem(cartKey, JSON.stringify(cart));
    onAddToCart(cart.items.length);
    toast.success("Produto adicionado ao carrinho");
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-lg" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Nenhum produto disponível no momento.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => {
          const primaryImage =
            product.images.find((img) => img.is_primary)?.url ||
            product.images[0]?.url;
          const hasDiscount =
            product.compare_at_price && product.compare_at_price > product.price;
          const discountPercent = hasDiscount
            ? Math.round(
                ((product.compare_at_price! - product.price) /
                  product.compare_at_price!) *
                  100
              )
            : 0;

          return (
            <Card
              key={product.id}
              className="group overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="relative aspect-square bg-muted">
                {primaryImage ? (
                  <img
                    src={primaryImage}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    Sem imagem
                  </div>
                )}

                {hasDiscount && (
                  <Badge
                    variant="destructive"
                    className="absolute top-2 left-2"
                  >
                    -{discountPercent}%
                  </Badge>
                )}

                {product.stock_quantity <= 0 && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Badge variant="secondary">Esgotado</Badge>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => addToCart(product)}
                    disabled={product.stock_quantity <= 0}
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <CardContent className="p-3">
                <h3 className="font-medium text-sm line-clamp-2 mb-2">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">
                    {formatPrice(product.price)}
                  </span>
                  {hasDiscount && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(product.compare_at_price!)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ProductDetailModal
        product={selectedProduct}
        open={!!selectedProduct}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
        onAddToCart={() => {
          if (selectedProduct) {
            addToCart(selectedProduct);
            setSelectedProduct(null);
          }
        }}
      />
    </>
  );
}
