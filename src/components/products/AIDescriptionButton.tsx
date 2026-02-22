import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Link2 } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface AIDescriptionButtonProps {
  type: 'short_description' | 'full_description';
  productName: string;
  fullDescription?: string;
  onGenerated: (text: string) => void;
  productFormat?: 'simple' | 'with_variants' | 'with_composition';
  productId?: string;
}

export function AIDescriptionButton({ type, productName, fullDescription, onGenerated, productFormat = 'simple', productId }: AIDescriptionButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [missingComponents, setMissingComponents] = useState<string[]>([]);

  const isKit = productFormat === 'with_composition';

  const generate = async (opts?: { prompt?: string; mode?: string; url?: string; components?: Array<{ name: string; description: string }> }) => {
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
          userPrompt: opts?.prompt || undefined,
          mode: opts?.mode || undefined,
          url: opts?.url || undefined,
          components: opts?.components || undefined,
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
      setLinkUrl('');
      setMissingComponents([]);
    } catch (err: any) {
      console.error('[AIDescriptionButton] Error:', err);
      toast.error(err.message || 'Erro ao gerar descrição');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKitClick = async () => {
    if (!productId) {
      toast.error('Salve o produto antes de gerar a descrição do kit');
      return;
    }

    // Fetch components and their descriptions
    const { data: components, error } = await supabase
      .from('product_components')
      .select('component_product_id, component:products!product_components_component_product_id_fkey(name, description)')
      .eq('parent_product_id', productId);

    if (error || !components || components.length === 0) {
      toast.error('Adicione produtos ao kit antes de gerar a descrição');
      return;
    }

    const missing = components.filter(c => {
      const comp = c.component as any;
      return !comp?.description?.trim();
    });

    if (missing.length > 0) {
      const names = missing.map(m => (m.component as any)?.name).filter(Boolean);
      setMissingComponents(names);
      setShowPromptDialog(true);
      return;
    }

    // All components have descriptions — generate directly
    const componentData = components.map(c => {
      const comp = c.component as any;
      return { name: comp.name, description: comp.description };
    });

    generate({ mode: 'from_kit', components: componentData });
  };

  const handleClick = () => {
    if (type === 'short_description') {
      if (!fullDescription?.trim()) {
        toast.error('Preencha a descrição completa primeiro para gerar a descrição curta');
        return;
      }
      generate();
    } else if (type === 'full_description') {
      if (isKit) {
        handleKitClick();
      } else {
        // Simple/variants: if has existing description, improve it directly (legacy)
        // Otherwise show dialog with URL input
        if (fullDescription?.trim()) {
          // Show dialog for improvement with optional URL
          setShowPromptDialog(true);
        } else {
          setShowPromptDialog(true);
        }
      }
    }
  };

  const handleGenerateFromDialog = () => {
    if (isKit) {
      // Kit dialog shouldn't reach here if missing components
      return;
    }

    // Simple/variants flow
    if (linkUrl.trim()) {
      // Mode: from_link
      generate({ mode: 'from_link', url: linkUrl.trim(), prompt: userPrompt.trim() || undefined });
    } else if (fullDescription?.trim()) {
      // Legacy: improve existing description
      generate({ prompt: userPrompt.trim() || undefined });
    } else if (userPrompt.trim()) {
      // Legacy: generate from prompt
      generate({ prompt: userPrompt.trim() });
    } else {
      toast.error('Forneça um link da página do produto ou informações para gerar a descrição');
    }
  };

  const canGenerate = () => {
    if (isKit) return false; // Kit dialog is just for showing missing components
    if (linkUrl.trim()) return true;
    if (fullDescription?.trim()) return true;
    if (userPrompt.trim()) return true;
    return false;
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

      <Dialog open={showPromptDialog} onOpenChange={(open) => {
        setShowPromptDialog(open);
        if (!open) {
          setMissingComponents([]);
          setLinkUrl('');
          setUserPrompt('');
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isKit ? 'Gerar Descrição do Kit' : 'Gerar Descrição com IA'}
            </DialogTitle>
            <DialogDescription>
              {isKit
                ? 'A IA vai combinar as descrições dos produtos do kit para criar uma descrição unificada.'
                : fullDescription?.trim()
                  ? 'A IA vai reorganizar e melhorar a descrição existente. Você pode fornecer um link de referência ou instruções extras.'
                  : 'Forneça o link da página do produto para a IA copiar as informações e gerar a descrição.'}
            </DialogDescription>
          </DialogHeader>

          {/* Kit: missing components warning */}
          {isKit && missingComponents.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Crie primeiro a descrição completa dos seguintes produtos:</strong>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {missingComponents.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm">
                  Após criar as descrições desses produtos, volte aqui para gerar a descrição do kit.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Simple/variants dialog */}
          {!isKit && (
            <div className="space-y-4">
              <div>
                <Label className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Link da página do produto {!fullDescription?.trim() && '*'}
                </Label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://exemplo.com/produto"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A IA vai extrair as informações da página e gerar a descrição automaticamente.
                </p>
              </div>

              <div>
                <Label>Instruções adicionais (opcional)</Label>
                <Textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Ex: Foque nos benefícios para cabelos oleosos, mencione que é vegano..."
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowPromptDialog(false)}>
              {isKit && missingComponents.length > 0 ? 'Entendi' : 'Cancelar'}
            </Button>
            {!isKit && (
              <Button
                type="button"
                onClick={handleGenerateFromDialog}
                disabled={!canGenerate() || isGenerating}
                className="gap-1.5"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isGenerating ? 'Gerando...' : 'Gerar Descrição'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
