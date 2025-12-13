import { Link, useParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function StorefrontHome() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { storeSettings, categories, products } = usePublicStorefront(tenantSlug || '');

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

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="relative py-20 md:py-32"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)`,
        }}
      >
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Bem-vindo à {storeSettings?.store_name || 'Nossa Loja'}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            {storeSettings?.store_description || 'Encontre os melhores produtos com os melhores preços.'}
          </p>
          <Button
            size="lg"
            style={{ backgroundColor: primaryColor }}
            className="text-white hover:opacity-90"
          >
            Ver Produtos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Categories Section */}
      {categories && categories.length > 0 && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Categorias</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.filter(c => !c.parent_id).slice(0, 8).map((category) => (
                <Link key={category.id} to={`${baseUrl}/c/${category.slug}`}>
                  <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
                    {category.image_url ? (
                      <div className="aspect-video relative overflow-hidden">
                        <img
                          src={category.image_url}
                          alt={category.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <h3 className="absolute bottom-4 left-4 text-white font-semibold">
                          {category.name}
                        </h3>
                      </div>
                    ) : (
                      <CardContent className="p-6">
                        <h3
                          className="font-semibold group-hover:text-primary transition-colors"
                          style={{ color: primaryColor }}
                        >
                          {category.name}
                        </h3>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products Section */}
      {products && products.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Produtos em Destaque</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {products.slice(0, 8).map((product) => (
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
          </div>
        </section>
      )}
    </div>
  );
}
