// =============================================
// STOREFRONT REVIEW - Página dedicada para avaliação via token
// Cliente recebe link único para avaliar produtos do pedido
// =============================================

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Package, CheckCircle, AlertCircle, Loader2, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

export default function StorefrontReview() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const productIdFromUrl = searchParams.get('product');
  const queryClient = useQueryClient();
  
  const [reviews, setReviews] = useState<Map<string, ReviewData>>(new Map());
  const [customerName, setCustomerName] = useState('');
  const [submittedProducts, setSubmittedProducts] = useState<Set<string>>(new Set());

  // Validate token and get order info
  const { data: tokenData, isLoading: isLoadingToken, error: tokenError } = useQuery({
    queryKey: ['review-token', token],
    queryFn: async () => {
      if (!token) throw new Error('Token não fornecido');
      
      const { data, error } = await supabase
        .rpc('validate_review_token', { p_token: token });
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Token inválido');
      
      const tokenInfo = data[0] as TokenData;
      if (!tokenInfo.is_valid) throw new Error('Link expirado ou já utilizado');
      
      return tokenInfo;
    },
    enabled: !!token,
    retry: false,
  });

  // Get order items
  const { data: orderItems, isLoading: isLoadingItems } = useQuery({
    queryKey: ['order-items-for-review', tokenData?.order_id],
    queryFn: async () => {
      if (!tokenData?.order_id) return [];
      
      const { data, error } = await supabase
        .from('order_items')
        .select('id, product_id, product_name, product_image_url, product_slug, quantity')
        .eq('order_id', tokenData.order_id);
      
      if (error) throw error;
      return data as OrderItem[];
    },
    enabled: !!tokenData?.order_id,
  });

  // Get existing reviews for this order's products
  const { data: existingReviews } = useQuery({
    queryKey: ['existing-reviews', tokenData?.tenant_id, tokenData?.customer_email, orderItems?.map(i => i.product_id)],
    queryFn: async () => {
      if (!tokenData?.tenant_id || !tokenData?.customer_email || !orderItems) return [];
      
      const productIds = orderItems.map(i => i.product_id).filter(Boolean);
      if (productIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('product_reviews')
        .select('product_id')
        .eq('tenant_id', tokenData.tenant_id)
        .ilike('customer_email', tokenData.customer_email)
        .in('product_id', productIds);
      
      if (error) return [];
      return data.map(r => r.product_id);
    },
    enabled: !!tokenData && !!orderItems && orderItems.length > 0,
  });

  // Get store name
  const { data: tenant } = useQuery({
    queryKey: ['tenant-for-review', tokenData?.tenant_id],
    queryFn: async () => {
      if (!tokenData?.tenant_id) return null;
      
      const { data, error } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', tokenData.tenant_id)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!tokenData?.tenant_id,
  });

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async ({ productId, review }: { productId: string; review: ReviewData }) => {
      if (!tokenData || !customerName.trim()) {
        throw new Error('Preencha seu nome para continuar');
      }

      const { error } = await supabase
        .from('product_reviews')
        .insert({
          tenant_id: tokenData.tenant_id,
          product_id: productId,
          customer_id: tokenData.customer_id,
          customer_name: customerName.trim(),
          customer_email: tokenData.customer_email,
          rating: review.rating,
          title: review.title.trim() || null,
          content: review.content.trim(),
          status: 'pending',
          is_verified_purchase: true, // Always true for token-based reviews
        });

      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      setSubmittedProducts(prev => new Set(prev).add(productId));
      toast.success('Avaliação enviada com sucesso!');
      
      // Clear the review from state
      setReviews(prev => {
        const newMap = new Map(prev);
        newMap.delete(productId);
        return newMap;
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao enviar avaliação');
    },
  });

  // Filter to show only products that haven't been reviewed yet
  const productsToReview = orderItems?.filter(item => 
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
  if (isLoadingToken || isLoadingItems) {
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
  if (tokenError || !tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription>
              {tokenError instanceof Error ? tokenError.message : 'Este link de avaliação não é válido ou já expirou.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // All products already reviewed
  if (filteredProducts.length === 0 && orderItems && orderItems.length > 0) {
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
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">
            Avalie sua Compra
          </h1>
          {tenant?.name && (
            <p className="text-muted-foreground">
              Sua opinião é muito importante para {tenant.name}
            </p>
          )}
        </div>

        {/* Customer Name (shared for all reviews) */}
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
                    {item.product_image_url && (
                      <img
                        src={item.product_image_url}
                        alt={item.product_name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
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

                  {/* Submit Button */}
                  <Button
                    onClick={() => handleSubmitReview(item.product_id)}
                    disabled={isSubmitting || !customerName.trim() || review.rating < 1 || review.content.length < 10}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
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
