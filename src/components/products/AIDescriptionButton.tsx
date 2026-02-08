import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface AIDescriptionButtonProps {
  type: 'short_description' | 'full_description';
  productName: string;
  fullDescription?: string;
  onGenerated: (text: string) => void;
}

export function AIDescriptionButton({ type, productName, fullDescription, onGenerated }: AIDescriptionButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');

  const generate = async (prompt?: string) => {
    if (!productName) {
      toast.error('Preencha o nome do produto antes de gerar a descrição');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-product-description', {
        body: {
          type,
          productName,
          fullDescription: fullDescription || undefined,
          userPrompt: prompt || undefined,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao chamar IA');
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erro ao gerar descrição');
        return;
      }

      onGenerated(data.description);
      toast.success(type === 'short_description' ? 'Descrição curta gerada!' : 'Descrição completa gerada!');
      setShowPromptDialog(false);
      setUserPrompt('');
    } catch (err: any) {
      console.error('[AIDescriptionButton] Error:', err);
      toast.error(err.message || 'Erro ao gerar descrição');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClick = () => {
    if (type === 'short_description') {
      if (!fullDescription?.trim()) {
        toast.error('Preencha a descrição completa primeiro para gerar a descrição curta');
        return;
      }
      generate();
    } else {
      // full_description
      if (fullDescription?.trim()) {
        // Has content — improve it directly
        generate();
      } else {
        // No content — show prompt dialog
        setShowPromptDialog(true);
      }
    }
  };

  const label = type === 'short_description'
    ? 'Gerar com IA'
    : fullDescription?.trim()
      ? 'Melhorar com IA'
      : 'Gerar com IA';

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isGenerating}
        className="gap-1.5"
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {isGenerating ? 'Gerando...' : label}
      </Button>

      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informações do Produto</DialogTitle>
            <DialogDescription>
              Descreva as informações base do produto para a IA gerar a descrição completa e profissional.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Ex: Shampoo anticaspa 250ml, para cabelos oleosos, com mentol e tea tree. Indicado para uso diário. Resultado em 7 dias..."
            rows={6}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPromptDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => generate(userPrompt)}
              disabled={!userPrompt.trim() || isGenerating}
              className="gap-1.5"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? 'Gerando...' : 'Gerar Descrição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
