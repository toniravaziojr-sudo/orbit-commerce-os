// =============================================
// ADD REVIEW DIALOG - Manual review creation
// =============================================

import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Star, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AddReviewDialogProps {
  trigger?: React.ReactNode;
}

export function AddReviewDialog({ trigger }: AddReviewDialogProps) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Form state
  const [productId, setProductId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isVerifiedPurchase, setIsVerifiedPurchase] = useState(false);
  const [status, setStatus] = useState<'pending' | 'approved'>('approved');

  // Fetch products - using REST API to avoid type depth issues
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-reviews', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const params = new URLSearchParams({
        tenant_id: `eq.${currentTenant.id}`,
        is_active: 'eq.true',
        select: 'id,name',
        order: 'name.asc',
      });
      const response = await fetch(`${supabaseUrl}/rest/v1/products?${params}`, {
        headers: { 'apikey': supabaseKey, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      return (await response.json()) as Array<{ id: string; name: string }>;
    },
    enabled: !!currentTenant?.id && open,
  });

  const resetForm = () => {
    setProductId('');
    setCustomerName('');
    setCustomerEmail('');
    setRating(5);
    setTitle('');
    setContent('');
    setIsVerifiedPurchase(false);
    setStatus('approved');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');
      if (!productId) throw new Error('Selecione um produto');
      if (!customerName.trim()) throw new Error('Informe o nome do cliente');
      if (!content.trim()) throw new Error('Informe o conteúdo da avaliação');

      const { error } = await supabase
        .from('product_reviews')
        .insert({
          tenant_id: currentTenant.id,
          product_id: productId,
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim() || null,
          rating,
          title: title.trim() || null,
          content: content.trim(),
          is_verified_purchase: isVerifiedPurchase,
          status,
          approved_at: status === 'approved' ? new Date().toISOString() : null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['product-rating'] });
      queryClient.invalidateQueries({ queryKey: ['product-ratings-batch'] });
      toast.success('Avaliação criada com sucesso');
      resetForm();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar avaliação');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar avaliação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar Avaliação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Product */}
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
          </div>

          {/* Customer Name */}
          <div className="space-y-2">
            <Label>Nome do Cliente *</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nome do cliente"
              maxLength={80}
            />
          </div>

          {/* Customer Email */}
          <div className="space-y-2">
            <Label>E-mail (opcional)</Label>
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label>Avaliação *</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'h-6 w-6 transition-colors',
                      (hoverRating || rating) >= star
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-muted-foreground'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Título (opcional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da avaliação"
              maxLength={100}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label>Conteúdo *</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva o conteúdo da avaliação..."
              rows={4}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">{content.length}/2000 caracteres</p>
          </div>

          {/* Verified Purchase */}
          <div className="flex items-center justify-between">
            <Label>Compra verificada</Label>
            <Switch
              checked={isVerifiedPurchase}
              onCheckedChange={setIsVerifiedPurchase}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'pending' | 'approved')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Aprovada (publicar imediatamente)</SelectItem>
                <SelectItem value="pending">Pendente (aguardar aprovação)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
