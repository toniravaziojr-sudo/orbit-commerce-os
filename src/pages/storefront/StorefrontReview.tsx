// =============================================
// STOREFRONT REVIEW - Página dedicada para avaliação via token
// v2 - Uses get-review-data edge function (no direct DB reads on order_items)
// =============================================

import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Star, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  product_slug: string | null;
  quantity: number;
}

interface TokenData {
  token_id: string;
  tenant_id: string;
  order_id: string;
  customer_id: string | null;
  customer_email: string | null;
  is_valid: boolean;
  store_url: string;
}

interface ReviewData {
  product_id: string;
  rating: number;
  title: string;
  content: string;
}

// Demo data for preview mode
const DEMO_TOKEN_DATA: TokenData = {
  token_id: 'demo-token',
  tenant_id: 'demo-tenant',
  order_id: 'demo-order',
  customer_id: null,
  customer_email: 'cliente@exemplo.com',
  is_valid: true,
  store_url: 'https://minhaloja.com.br',
};

const DEMO_ORDER_ITEMS: OrderItem[] = [
  {
    id: '1',
    product_id: 'prod-1',
    product_name: 'Camiseta Premium Preta',
    product_image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200',
    product_slug: 'camiseta-premium-preta',
    quantity: 2,
  },
  {
    id: '2',
    product_id: 'prod-2',
    product_name: 'Calça Jeans Slim Fit',
    product_image_url: 'https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=200',
    product_slug: 'calca-jeans-slim-fit',
    quantity: 1,
  },
];

export default function StorefrontReview() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const productIdFromUrl = searchParams.get('product');
  const isPreviewMode = searchParams.get('preview') === 'true';
  
  const [reviews, setReviews] = useState<Map<string, ReviewData>>(new Map());
  const [customerName, setCustomerName] = useState('');
  const [submittedProducts, setSubmittedProducts] = useState<Set<string>>(new Set());

  // Fetch all review data via edge function (token + items + existing reviews + store name)
  const { data: reviewData, isLoading: isLoadingData, error: dataError } = useQuery({
    queryKey: ['review-data', token],
    queryFn: async () => {
      if (!token) throw new Error('Token não fornecido');
      
      const { data, error } = await supabase.functions.invoke('get-review-data', {
        body: { token },
      });
      
      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Token inválido');
      }
      
      return data as {
        token_data: TokenData;
        items: OrderItem[];
        existing_review_product_ids: string[];
        store_name: string | null;
      };
    },
    enabled: !!token && !isPreviewMode,
    retry: false,
  });

  // Use demo or real data
  const activeTokenData = isPreviewMode ? DEMO_TOKEN_DATA : reviewData?.token_data;
  const activeOrderItems = isPreviewMode ? DEMO_ORDER_ITEMS : reviewData?.items;
  const existingReviews = isPreviewMode ? [] : reviewData?.existing_review_product_ids;
  const storeName = isPreviewMode ? 'Minha Loja Demo' : reviewData?.store_name;

  // Submit review mutation (still writes directly — product_reviews INSERT policy is separate)
  const submitReviewMutation = useMutation({
    mutationFn: async ({ productId, review }: { productId: string; review: ReviewData }) => {
      if (isPreviewMode) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return productId;
      }
      
      if (!activeTokenData || !customerName.trim()) {
        throw new Error('Preencha seu nome para continuar');
      }

      const { error } = await supabase
        .from('product_reviews')
        .insert({
          tenant_id: activeTokenData.tenant_id,
          product_id: productId,
          customer_id: activeTokenData.customer_id,
          customer_name: customerName.trim(),
          customer_email: activeTokenData.customer_email,
          rating: review.rating,
          title: review.title.trim() || null,
          content: review.content.trim(),
          status: 'pending',
          is_verified_purchase: true,
        });

      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      setSubmittedProducts(prev => new Set(prev).add(productId));
      toast.success(isPreviewMode ? '[Preview] Avaliação enviada!' : 'Avaliação enviada com sucesso!');
      
      setReviews(prev => {
        const newMap = new Map(prev);
        newMap.delete(productId);
        return newMap;
      });
    },
    onError: (err) => showErrorToast(err, { module: 'loja', action: 'enviar' }),
  });

  // Filter to show only products that haven't been reviewed yet
  const productsToReview = activeOrderItems?.filter(item => 
    item.product_id && 
    !existingReviews?.includes(item.product_id) &&
    !submittedProducts.has(item.product_id)
  ) || [];

  // If productIdFromUrl is specified, filter to just that product
  const filteredProducts = productIdFromUrl 
    ? productsToReview.filter(p => p.product_id === productIdFromUrl)
    : productsToReview;

  const updateReview = (productId: string, field: keyof ReviewData, value: string | number) => {
    setReviews(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(productId) || { product_id: productId, rating: 0, title: '', content: '' };
      newMap.set(productId, { ...existing, [field]: value });
      return newMap;
    });
  };

  const getReview = (productId: string): ReviewData => {
    return reviews.get(productId) || { product_id: productId, rating: 0, title: '', content: '' };
  };

  const handleSubmitReview = (productId: string) => {
    const review = getReview(productId);
    if (review.rating < 1 || review.rating > 5) {
      toast.error('Selecione uma avaliação de 1 a 5 estrelas');
      return;
    }
    if (review.content.trim().length < 10) {
      toast.error('O comentário deve ter pelo menos 10 caracteres');
      return;
    }
    submitReviewMutation.mutate({ productId, review });
  };

  // Loading state
  if (!isPreviewMode && isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!isPreviewMode && (dataError || !activeTokenData)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription>
              {dataError instanceof Error ? dataError.message : 'Este link de avaliação não é válido ou já expirou.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // All products already reviewed
  if (filteredProducts.length === 0 && activeOrderItems && activeOrderItems.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
            <CardTitle>Obrigado!</CardTitle>
            <CardDescription>
              {submittedProducts.size > 0 
                ? 'Sua avaliação foi enviada com sucesso!'
                : 'Você já avaliou todos os produtos deste pedido.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Preview Mode Banner */}
        {isPreviewMode && (
          <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg p-3 mb-6 text-center">
            <Badge variant="outline" className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 border-amber-400">
              Modo Preview
            </Badge>
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
              Esta é uma demonstração da página de avaliação. Os dados são fictícios.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">
            Avalie sua Compra
          </h1>
          {storeName && (
            <p className="text-muted-foreground">
              Sua opinião é muito importante para {storeName}
            </p>
          )}
        </div>

        {/* Customer Name */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Label htmlFor="customer-name" className="text-sm font-medium">
              Seu nome *
            </Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Como você gostaria de ser identificado?"
              className="mt-2"
              maxLength={80}
            />
          </CardContent>
        </Card>

        {/* Products to Review */}
        <div className="space-y-6">
          {filteredProducts.map((item) => {
            const review = getReview(item.product_id);
            const isSubmitting = submitReviewMutation.isPending;
            
            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    {item.product_image_url ? (
                      <img
                        src={item.product_image_url}
                        alt={item.product_name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                        <span className="text-muted-foreground text-xs">Sem foto</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-base">{item.product_name}</CardTitle>
                      <CardDescription>Quantidade: {item.quantity}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Star Rating */}
                  <div>
                    <Label className="text-sm mb-2 block">Avaliação *</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => updateReview(item.product_id, 'rating', star)}
                          className="p-1 transition-transform hover:scale-110"
                        >
                          <Star
                            className={cn(
                              'h-7 w-7 transition-colors',
                              review.rating >= star
                                ? 'text-primary fill-primary'
                                : 'text-muted-foreground hover:text-primary/60'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <Label htmlFor={`title-${item.id}`} className="text-sm">
                      Título (opcional)
                    </Label>
                    <Input
                      id={`title-${item.id}`}
                      value={review.title}
                      onChange={(e) => updateReview(item.product_id, 'title', e.target.value)}
                      placeholder="Resuma sua experiência"
                      maxLength={100}
                      className="mt-1"
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <Label htmlFor={`content-${item.id}`} className="text-sm">
                      Comentário *
                    </Label>
                    <Textarea
                      id={`content-${item.id}`}
                      value={review.content}
                      onChange={(e) => updateReview(item.product_id, 'content', e.target.value)}
                      placeholder="Conte-nos mais sobre sua experiência com este produto..."
                      rows={4}
                      maxLength={2000}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {review.content.length}/2000 caracteres (mínimo 10)
                    </p>
                  </div>

                  {/* Verified Purchase Badge */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Compra verificada</span>
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={() => handleSubmitReview(item.product_id)}
                    disabled={isSubmitting || !customerName.trim() || review.rating < 1 || review.content.length < 10}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar Avaliação'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Suas avaliações serão analisadas antes de serem publicadas.
        </p>
      </div>
    </div>
  );
}