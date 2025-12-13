import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { CartDrawer } from "@/components/store/CartDrawer";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  images: { url: string; is_primary: boolean }[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export default function CategoryPage() {
  const { tenantSlug, categorySlug } = useParams<{
    tenantSlug: string;
    categorySlug: string;
  }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!tenantSlug || !categorySlug) return;

      // Buscar tenant
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("slug", tenantSlug)
        .single();

      if (!tenantData) {
        setLoading(false);
        return;
      }
      setTenant(tenantData);

      // Buscar categoria
      const { data: categoryData } = await supabase
        .from("categories")
        .select("*")
        .eq("tenant_id", tenantData.id)
        .eq("slug", categorySlug)
        .eq("is_active", true)
        .single();

      if (categoryData) {
        setCategory(categoryData);

        // Buscar produtos da categoria
        const { data: productCategories } = await supabase
          .from("product_categories")
          .select("product_id")
          .eq("category_id", categoryData.id);

        if (productCategories && productCategories.length > 0) {
          const productIds = productCategories.map((pc) => pc.product_id);

          const { data: productsData } = await supabase
            .from("products")
            .select(`
              id,
              name,
              slug,
              price,
              compare_at_price,
              stock_quantity,
              product_images (url, is_primary)
            `)
            .in("id", productIds)
            .eq("status", "active");

          if (productsData) {
            const formattedProducts = productsData.map((product) => ({
              ...product,
              images: product.product_images || [],
            }));
            setProducts(formattedProducts);
          }
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [tenantSlug, categorySlug]);

  useEffect(() => {
    const cartKey = `cart_${tenantSlug}`;
    const savedCart = localStorage.getItem(cartKey);
    if (savedCart) {
      try {
        const cart = JSON.parse(savedCart);
        setCartItemCount(cart.items?.length || 0);
      } catch {
        setCartItemCount(0);
      }
    }
  }, [tenantSlug]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

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
    setCartItemCount(cart.items.length);
    toast.success("Produto adicionado ao carrinho");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16 border-b">
          <Skeleton className="h-full" />
        </div>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!category || !tenant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Categoria não encontrada</h1>
          <p className="text-muted-foreground mb-4">
            A categoria que você procura não existe.
          </p>
          <Button asChild>
            <Link to={`/store/${tenantSlug}`}>Voltar para a loja</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StoreHeader
        storeName={tenant.name}
        cartItemCount={cartItemCount}
        onCartClick={() => setCartOpen(true)}
      />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link
              to={`/store/${tenantSlug}`}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar para a loja
            </Link>
          </div>

          {/* Category Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-muted-foreground">{category.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {products.length} produto(s)
            </p>
          </div>

          {/* Products Grid */}
          {products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Nenhum produto nesta categoria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => {
                const primaryImage =
                  product.images.find((img) => img.is_primary)?.url ||
                  product.images[0]?.url;
                const hasDiscount =
                  product.compare_at_price &&
                  product.compare_at_price > product.price;
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
                    <Link to={`/store/${tenantSlug}/product/${product.slug}`}>
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
                      </div>
                    </Link>

                    <CardContent className="p-3">
                      <Link to={`/store/${tenantSlug}/product/${product.slug}`}>
                        <h3 className="font-medium text-sm line-clamp-2 mb-2 hover:text-primary">
                          {product.name}
                        </h3>
                      </Link>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-primary">
                            {formatPrice(product.price)}
                          </span>
                          {hasDiscount && (
                            <span className="text-xs text-muted-foreground line-through ml-2">
                              {formatPrice(product.compare_at_price!)}
                            </span>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => addToCart(product)}
                          disabled={product.stock_quantity <= 0}
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <StoreFooter storeName={tenant.name} />

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        tenantSlug={tenantSlug!}
        tenantId={tenant.id}
        onCartUpdate={setCartItemCount}
      />
    </div>
  );
}
