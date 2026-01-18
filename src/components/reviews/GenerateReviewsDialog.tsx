// =============================================
// GENERATE REVIEWS DIALOG - AI-powered review generation
// =============================================

import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface GenerateReviewsDialogProps {
  trigger?: React.ReactNode;
}

type QuantityOption = '10' | '30' | '50';

interface GeneratedReview {
  customer_name: string;
  rating: number;
  title: string;
  content: string;
}

export function GenerateReviewsDialog({ trigger }: GenerateReviewsDialogProps) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState<QuantityOption>('10');
  const [generatedReviews, setGeneratedReviews] = useState<GeneratedReview[]>([]);
  const [step, setStep] = useState<'select' | 'generating' | 'preview'>('select');
  const [progress, setProgress] = useState(0);

  // Fetch products - using REST API to avoid type depth issues
  type ProductOption = { id: string; name: string; description: string | null; price: number | null; sku: string | null };
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-reviews-generate', currentTenant?.id],
    queryFn: async (): Promise<ProductOption[]> => {
      if (!currentTenant?.id) return [];
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const params = new URLSearchParams({
        tenant_id: `eq.${currentTenant.id}`,
        is_active: 'eq.true',
        select: 'id,name,description,price,sku',
        order: 'name.asc',
      });
      const response = await fetch(`${supabaseUrl}/rest/v1/products?${params}`, {
        headers: { 'apikey': supabaseKey, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      return await response.json();
    },
    enabled: !!currentTenant?.id && open,
  });

  const selectedProduct = products.find(p => p.id === productId);

  const resetDialog = () => {
    setProductId('');
    setQuantity('10');
    setGeneratedReviews([]);
    setStep('select');
    setProgress(0);
  };

  // Generate reviews mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error('Selecione um produto');

      setStep('generating');
      setProgress(10);

      const { data, error } = await supabase.functions.invoke('generate-reviews', {
        body: {
          product: {
            name: selectedProduct.name,
            description: selectedProduct.description,
            price: selectedProduct.price,
            sku: selectedProduct.sku,
          },
          quantity: parseInt(quantity),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar avaliações');

      setProgress(100);
      return data.reviews as GeneratedReview[];
    },
    onSuccess: (reviews) => {
      setGeneratedReviews(reviews);
      setStep('preview');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao gerar avaliações');
      setStep('select');
    },
  });

  // Save reviews mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id || !productId) throw new Error('Dados inválidos');

      const reviewsToInsert = generatedReviews.map(review => ({
        tenant_id: currentTenant.id,
        product_id: productId,
        customer_name: review.customer_name,
        rating: review.rating,
        title: review.title,
        content: review.content,
        status: 'pending', // All AI reviews go to pending for approval
        is_verified_purchase: false,
      }));

      const { error } = await supabase
        .from('product_reviews')
        .insert(reviewsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews'] });
      toast.success(`${generatedReviews.length} avaliações criadas e aguardando aprovação`);
      resetDialog();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar avaliações');
    },
  });

  const renderStars = (rating: number) => (
    <span className="text-yellow-500">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetDialog();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar com IA
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Avaliações com IA
          </DialogTitle>
          <DialogDescription>
            A IA irá gerar avaliações realistas baseadas nas informações do produto selecionado.
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-6 mt-4">
            {/* Product Selection */}
            <div className="space-y-2">
              <Label>Produto *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProduct?.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {selectedProduct.description}
                </p>
              )}
            </div>

            {/* Quantity Selection */}
            <div className="space-y-3">
              <Label>Quantidade de avaliações</Label>
              <RadioGroup value={quantity} onValueChange={(v) => setQuantity(v as QuantityOption)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="10" id="q10" />
                  <Label htmlFor="q10" className="font-normal cursor-pointer">10 avaliações</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="30" id="q30" />
                  <Label htmlFor="q30" className="font-normal cursor-pointer">30 avaliações</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="50" id="q50" />
                  <Label htmlFor="q50" className="font-normal cursor-pointer">50 avaliações</Label>
                </div>
              </RadioGroup>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                As avaliações geradas serão criadas com status "Pendente" e você precisará aprová-las antes de ficarem visíveis na loja.
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!productId || generateMutation.isPending}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Avaliações
              </Button>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="font-medium">Gerando avaliações...</p>
              <p className="text-sm text-muted-foreground">
                A IA está criando {quantity} avaliações realistas para "{selectedProduct?.name}"
              </p>
            </div>
            <Progress value={progress} className="w-64" />
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {generatedReviews.length} avaliações geradas para "{selectedProduct?.name}"
              </p>
            </div>

            {/* Reviews List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {generatedReviews.map((review, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{review.customer_name}</span>
                    {renderStars(review.rating)}
                  </div>
                  {review.title && (
                    <p className="font-medium text-sm">{review.title}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{review.content}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-between gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => {
                setGeneratedReviews([]);
                setStep('select');
              }}>
                Gerar novamente
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar {generatedReviews.length} avaliações
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
