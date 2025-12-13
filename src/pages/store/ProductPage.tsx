import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { CartDrawer } from "@/components/store/CartDrawer";

interface ProductImage {
  id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  status: string;
  sku: string;
}

export default function ProductPage() {
  const { tenantSlug, productSlug } = useParams<{
    tenantSlug: string;
    productSlug: string;
  }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!tenantSlug || !productSlug) return;

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

      // Buscar produto
      const { data: productData } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantData.id)
        .eq("slug", productSlug)
        .eq("status", "active")
        .single();

      if (productData) {
        setProduct(productData);

        // Buscar imagens
        const { data: imagesData } = await supabase
          .from("product_images")
          .select("*")
          .eq("product_id", productData.id)
          .order("sort_order");

        if (imagesData) {
          setImages(imagesData);
          const primary = imagesData.find((img) => img.is_primary);
          setSelectedImage(primary?.url || imagesData[0]?.url || null);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [tenantSlug, productSlug]);

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

  const addToCart = () => {
    if (!product) return;

    const cartKey = `cart_${tenantSlug}`;
    const savedCart = localStorage.getItem(cartKey);
    let cart = savedCart ? JSON.parse(savedCart) : { items: [] };

    const existingIndex = cart.items.findIndex(
      (item: any) => item.productId === product.id
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: selectedImage,
        quantity: quantity,
      });
    }

    localStorage.setItem(cartKey, JSON.stringify(cart));
    setCartItemCount(cart.items.length);
    toast.success(`${quantity}x ${product.name} adicionado ao carrinho`);
  };

  const hasDiscount =
    product?.compare_at_price && product.compare_at_price > product.price;
  const discountPercent = hasDiscount
    ? Math.round(
        ((product!.compare_at_price! - product!.price) /
          product!.compare_at_price!) *
          100
      )
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16 border-b">
          <Skeleton className="h-full" />
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product || !tenant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Produto não encontrado</h1>
          <p className="text-muted-foreground mb-4">
            O produto que você procura não existe ou foi removido.
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

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Galeria de imagens */}
            <div className="space-y-4">
              <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                {selectedImage ? (
                  <img
                    src={selectedImage}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    Sem imagem
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.map((image) => (
                    <button
                      key={image.id}
                      onClick={() => setSelectedImage(image.url)}
                      className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-colors ${
                        selectedImage === image.url
                          ? "border-primary"
                          : "border-transparent"
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.alt_text || product.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Informações do produto */}
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">
                  {product.name}
                </h1>
                <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
              </div>

              {/* Preço */}
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-primary">
                  {formatPrice(product.price)}
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-xl text-muted-foreground line-through">
                      {formatPrice(product.compare_at_price!)}
                    </span>
                    <Badge variant="destructive">-{discountPercent}%</Badge>
                  </>
                )}
              </div>

              {/* Descrição */}
              {product.short_description && (
                <p className="text-muted-foreground">
                  {product.short_description}
                </p>
              )}

              {/* Estoque */}
              {product.stock_quantity > 0 ? (
                <p className="text-sm text-green-600">
                  {product.stock_quantity} unidades em estoque
                </p>
              ) : (
                <Badge variant="secondary">Produto Esgotado</Badge>
              )}

              {/* Quantidade e Adicionar */}
              {product.stock_quantity > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">Quantidade:</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">
                        {quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setQuantity(
                            Math.min(product.stock_quantity, quantity + 1)
                          )
                        }
                        disabled={quantity >= product.stock_quantity}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Button className="w-full" size="lg" onClick={addToCart}>
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Adicionar ao Carrinho
                  </Button>
                </div>
              )}

              {/* Descrição completa */}
              {product.description && (
                <div className="pt-6 border-t">
                  <h2 className="font-semibold mb-3">Descrição</h2>
                  <div
                    className="text-muted-foreground prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                </div>
              )}
            </div>
          </div>
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
