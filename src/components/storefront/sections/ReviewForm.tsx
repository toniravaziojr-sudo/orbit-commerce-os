// =============================================
// REVIEW FORM - Customer-facing review submission form
// =============================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReviewFormProps {
  productId: string;
  tenantId: string;
  onSuccess?: () => void;
}

export function ReviewForm({ productId, tenantId, onSuccess }: ReviewFormProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Validation
      if (rating < 1 || rating > 5) {
        throw new Error('Selecione uma avaliação de 1 a 5 estrelas');
      }
      if (name.trim().length < 2 || name.trim().length > 80) {
        throw new Error('Nome deve ter entre 2 e 80 caracteres');
      }
      if (content.trim().length < 10 || content.trim().length > 2000) {
        throw new Error('Comentário deve ter entre 10 e 2000 caracteres');
      }

      // All reviews go to pending - requires admin approval
      const { error } = await supabase
        .from('product_reviews')
        .insert({
          product_id: productId,
          tenant_id: tenantId,
          customer_name: name.trim(),
          customer_email: email.trim() || null,
          title: title.trim() || null,
          content: content.trim(),
          rating,
          status: 'pending', // Always pending - requires admin approval
        });

      if (error) throw error;
    },
    onSuccess: () => {
      // Reset form
      setRating(0);
      setName('');
      setEmail('');
      setTitle('');
      setContent('');
      setIsOpen(false);
      
      toast.success('Sua avaliação foi enviada e está pendente de aprovação');
      
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao enviar avaliação');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate();
  };

  if (!isOpen) {
    return (
      <div className="w-full flex justify-center mt-4">
        <Button
          variant="outline"
          onClick={() => setIsOpen(true)}
        >
          Escrever uma avaliação
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 p-4 border rounded-lg bg-card">
      <h3 className="font-semibold mb-4">Sua avaliação</h3>
      
      {/* Star Rating */}
      <div className="mb-4">
        <Label className="text-sm mb-2 block">Avaliação *</Label>
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

      {/* Name */}
      <div className="mb-4">
        <Label htmlFor="review-name" className="text-sm mb-2 block">
          Seu nome *
        </Label>
        <Input
          id="review-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Digite seu nome"
          maxLength={80}
          required
        />
      </div>

      {/* Email */}
      <div className="mb-4">
        <Label htmlFor="review-email" className="text-sm mb-2 block">
          E-mail (opcional)
        </Label>
        <Input
          id="review-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          maxLength={255}
        />
      </div>

      {/* Title */}
      <div className="mb-4">
        <Label htmlFor="review-title" className="text-sm mb-2 block">
          Título (opcional)
        </Label>
        <Input
          id="review-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Resumo da sua avaliação"
          maxLength={100}
        />
      </div>

      {/* Content */}
      <div className="mb-4">
        <Label htmlFor="review-content" className="text-sm mb-2 block">
          Comentário *
        </Label>
        <Textarea
          id="review-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Conte sua experiência com o produto..."
          rows={4}
          minLength={10}
          maxLength={2000}
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          {content.length}/2000 caracteres
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? 'Enviando...' : 'Enviar avaliação'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsOpen(false)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
