import { Link, useParams } from 'react-router-dom';
import { usePublicCategory } from '@/hooks/useStorefront';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Loader2 } from 'lucide-react';

export default function StorefrontCategory() {
  const { tenantSlug, categorySlug } = useParams<{ tenantSlug: string; categorySlug: string }>();
  const { storeSettings } = usePublicStorefront(tenantSlug || '');
  const { category, products, isLoading } = usePublicCategory(tenantSlug || '', categorySlug || '');

  const baseUrl = `/store/${tenantSlug}`;
  const primaryColor = storeSettings?.primary_color || '#6366f1';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getProductImage = (product: any) => {
    const images = product.product_images || [];
    const primary = images.find((img: any) => img.is_primary);
    return primary?.url || images[0]?.url || '/placeholder.svg';
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Categoria não encontrada</h1>
          <p className="text-gray-600">Esta categoria não existe ou não está ativa.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header with breadcrumbs */}
      <div className="bg-gray-50 border-b">
        <div className="container mx-auto px-4 py-6">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link to={baseUrl} className="hover:text-gray-700">
              Home
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-900 font-medium">{category.name}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {category.image_url && (
              <img
                src={category.image_url}
                alt={category.name}
                className="w-24 h-24 object-cover rounded-lg"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
              {category.description && (
                <p className="text-gray-600 mt-2">{category.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-8">
        {products && products.length > 0 ? (
          <>
            <p className="text-sm text-gray-500 mb-6">
              {products.length} produto{products.length !== 1 ? 's' : ''} encontrado{products.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <Link key={product.id} to={`${baseUrl}/p/${product.slug}`}>
                  <Card className="group h-full hover:shadow-lg transition-all duration-300 overflow-hidden">
                    <div className="aspect-square relative overflow-hidden bg-gray-100">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-gray-900 line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-baseline gap-2">
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-sm text-gray-400 line-through">
                            {formatCurrency(product.compare_at_price)}
                          </span>
                        )}
                        <span
                          className="text-lg font-bold"
                          style={{ color: primaryColor }}
                        >
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhum produto encontrado nesta categoria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
