import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";

interface ProductImage {
  url: string;
  alt_text: string | null;
  is_primary: boolean;
}

interface Product {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  short_description: string | null;
  stock_quantity: number;
  images: ProductImage[];
}

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: () => void;
}

export function ProductDetailModal({
  product,
  open,
  onOpenChange,
  onAddToCart,
}: ProductDetailModalProps) {
  if (!product) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="aspect-square bg-muted rounded-lg overflow-hidden">
            {primaryImage ? (
              <img
                src={primaryImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Sem imagem
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <h2 className="text-xl font-bold mb-2">{product.name}</h2>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl font-bold text-primary">
                {formatPrice(product.price)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(product.compare_at_price!)}
                  </span>
                  <Badge variant="destructive">-{discountPercent}%</Badge>
                </>
              )}
            </div>

            {product.short_description && (
              <p className="text-muted-foreground mb-4">
                {product.short_description}
              </p>
            )}

            <div className="mt-auto space-y-3">
              {product.stock_quantity > 0 ? (
                <>
                  <p className="text-sm text-green-600">
                    {product.stock_quantity} em estoque
                  </p>
                  <Button className="w-full" size="lg" onClick={onAddToCart}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Adicionar ao Carrinho
                  </Button>
                </>
              ) : (
                <Badge variant="secondary" className="w-full justify-center py-2">
                  Produto Esgotado
                </Badge>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
