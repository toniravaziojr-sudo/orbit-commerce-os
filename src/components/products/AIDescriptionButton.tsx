import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Plus, X } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [referenceLinks, setReferenceLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState('');

  const addLink = () => {
    const url = newLink.trim();
    if (url && !referenceLinks.includes(url)) {
      setReferenceLinks(prev => [...prev, url]);
      setNewLink('');
    }
  };

  const removeLink = (index: number) => {
    setReferenceLinks(prev => prev.filter((_, i) => i !== index));
  };

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
          referenceLinks: referenceLinks.length > 0 ? referenceLinks : undefined,
        },
      });

      if (error) throw new Error(error.message || 'Erro ao chamar IA');

      if (!data?.success) {
        toast.error(data?.error || 'Erro ao gerar descrição');
        return;
      }

      onGenerated(data.description);
      toast.success('Descrição gerada com sucesso!');
      setShowPromptDialog(false);
      setUserPrompt('');
      setReferenceLinks([]);
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
      // full_description — always show prompt dialog
      setShowPromptDialog(true);
    }
  };

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
        {isGenerating ? 'Gerando...' : 'Gerar com IA'}
      </Button>

      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar Descrição com IA</DialogTitle>
            <DialogDescription>
              {fullDescription?.trim()
                ? 'A IA vai reorganizar e melhorar a descrição existente. Você pode adicionar instruções extras e links de referência.'
                : 'Forneça as informações base do produto para a IA gerar uma descrição completa e profissional.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{fullDescription?.trim() ? 'Instruções adicionais (opcional)' : 'Informações do produto *'}</Label>
              <Textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Ex: Shampoo anticaspa 250ml, para cabelos oleosos, com mentol e tea tree. Indicado para uso diário. Resultado em 7 dias..."
                rows={5}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Links de referência (opcional)</Label>
              <p className="text-xs text-muted-foreground mb-1.5">
                A IA usará esses links como referência de estrutura e conteúdo.
              </p>
              <div className="flex gap-2">
                <Input
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://exemplo.com/produto"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addLink} disabled={!newLink.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {referenceLinks.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {referenceLinks.map((link, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded px-2 py-1">
                      <span className="truncate flex-1">{link}</span>
                      <button type="button" onClick={() => removeLink(i)} className="shrink-0 hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowPromptDialog(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => generate(userPrompt)}
              disabled={(!fullDescription?.trim() && !userPrompt.trim()) || isGenerating}
              className="gap-1.5"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? 'Gerando...' : 'Gerar Descrição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
