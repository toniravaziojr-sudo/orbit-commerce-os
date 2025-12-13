import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePublicProduct, usePublicStorefront } from '@/hooks/useStorefront';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Loader2, Minus, Plus, ShoppingCart, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function StorefrontProduct() {
  const { tenantSlug, productSlug } = useParams<{ tenantSlug: string; productSlug: string }>();
  const { storeSettings } = usePublicStorefront(tenantSlug || '');
  const { product, category, isLoading } = usePublicProduct(tenantSlug || '', productSlug || '');
  const { addItem } = useCart(tenantSlug || '');
  const { toast } = useToast();

  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);

  const baseUrl = `/store/${tenantSlug}`;
  const primaryColor = storeSettings?.primary_color || '#6366f1';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleAddToCart = () => {
    if (!product) return;

    const images = product.product_images || [];
    const primaryImage = images.find((img: any) => img.is_primary) || images[0];

    addItem({
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity,
      image_url: primaryImage?.url,
    });

    setAddedToCart(true);
    toast({
      title: 'Produto adicionado!',
      description: `${product.name} foi adicionado ao carrinho.`,
    });

    setTimeout(() => setAddedToCart(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Produto não encontrado</h1>
          <p className="text-gray-600">Este produto não existe ou não está disponível.</p>
        </div>
      </div>
    );
  }

  const images = product.product_images || [];
  const sortedImages = [...images].sort((a: any, b: any) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPercentage = hasDiscount
    ? Math.round((1 - product.price / product.compare_at_price!) * 100)
    : 0;

  return (
    <div className="min-h-screen">
      {/* Breadcrumbs */}
      <div className="bg-gray-50 border-b">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link to={baseUrl} className="hover:text-gray-700">
              Home
            </Link>
            {category && (
              <>
                <ChevronRight className="h-4 w-4" />
                <Link to={`${baseUrl}/c/${category.slug}`} className="hover:text-gray-700">
                  {category.name}
                </Link>
              </>
            )}
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-900 font-medium line-clamp-1">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Product Details */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="aspect-square relative overflow-hidden rounded-lg bg-gray-100">
              {sortedImages.length > 0 ? (
                <img
                  src={(sortedImages[selectedImage] as any)?.url || '/placeholder.svg'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  Sem imagem
                </div>
              )}
              {hasDiscount && (
                <Badge
                  className="absolute top-4 left-4 text-white"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  -{discountPercentage}%
                </Badge>
              )}
            </div>

            {/* Thumbnails */}
            {sortedImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {sortedImages.map((image: any, index: number) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage === index ? 'border-primary' : 'border-transparent'
                    }`}
                    style={selectedImage === index ? { borderColor: primaryColor } : {}}
                  >
                    <img
                      src={image.url}
                      alt={`${product.name} - ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500 mb-2">SKU: {product.sku}</p>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                {hasDiscount && (
                  <span className="text-xl text-gray-400 line-through">
                    {formatCurrency(product.compare_at_price!)}
                  </span>
                )}
                <span
                  className="text-3xl font-bold"
                  style={{ color: primaryColor }}
                >
                  {formatCurrency(product.price)}
                </span>
              </div>
            </div>

            {/* Short Description */}
            {product.short_description && (
              <p className="text-gray-600">{product.short_description}</p>
            )}

            {/* Stock */}
            <div>
              {product.stock_quantity > 0 ? (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  Em estoque ({product.stock_quantity} disponíveis)
                </p>
              ) : product.allow_backorder ? (
                <p className="text-sm text-yellow-600">Sob encomenda</p>
              ) : (
                <p className="text-sm text-red-600">Fora de estoque</p>
              )}
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Quantidade:</span>
              <div className="flex items-center border rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={product.stock_quantity > 0 && quantity >= product.stock_quantity}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Add to Cart */}
            <Button
              size="lg"
              className="w-full text-white"
              style={{ backgroundColor: addedToCart ? '#22c55e' : primaryColor }}
              onClick={handleAddToCart}
              disabled={product.stock_quantity <= 0 && !product.allow_backorder}
            >
              {addedToCart ? (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Adicionado!
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Adicionar ao Carrinho
                </>
              )}
            </Button>

            {/* Description */}
            {product.description && (
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-3">Descrição</h3>
                <div
                  className="text-gray-600 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
