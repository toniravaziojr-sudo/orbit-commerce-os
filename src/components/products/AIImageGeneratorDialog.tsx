import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Package, User, Megaphone } from 'lucide-react';
import { toast } from 'sonner';

interface AIImageGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  primaryImageUrl: string;
  currentImageCount: number;
  onImagesGenerated: () => void;
}

const STYLES = [
  { value: 'product_natural', label: 'Produto + Fundo Natural', icon: Package, description: 'Produto em cenário natural, sem pessoas' },
  { value: 'person_interacting', label: 'Pessoa + Produto', icon: User, description: 'Pessoa usando ou segurando o produto' },
  { value: 'promotional', label: 'Promocional', icon: Megaphone, description: 'Visual de anúncio com impacto' },
];

export function AIImageGeneratorDialog({
  open, onOpenChange, productId, productName, primaryImageUrl, currentImageCount, onImagesGenerated,
}: AIImageGeneratorDialogProps) {
  const { currentTenant } = useAuth();
  const [quantity, setQuantity] = useState('2');
  const [style, setStyle] = useState('product_natural');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const maxImages = Math.min(5, 10 - currentImageCount); // Limit total to 10 images

  const handleGenerate = async () => {
    if (!currentTenant?.id) return;
    const count = parseInt(quantity);
    setIsGenerating(true);
    setProgress(0);

    let successCount = 0;

    try {
      for (let i = 0; i < count; i++) {
        setProgress(i + 1);

        try {
          const { data, error } = await supabase.functions.invoke('creative-image-generate', {
            body: {
              tenant_id: currentTenant.id,
              style,
              product_name: productName,
              reference_image_url: primaryImageUrl,
              format: '1:1',
              context_brief: `Gerar imagem variação ${i + 1} do produto "${productName}" no estilo ${style}`,
            },
          });

          if (error) {
            console.error(`Error generating image ${i + 1}:`, error);
            continue;
          }

          const imageUrl = data?.image_url || data?.url;
          if (!imageUrl) {
            console.error(`No image URL in response for image ${i + 1}`);
            continue;
          }

          // Save as product image
          const { error: insertError } = await supabase.from('product_images').insert({
            product_id: productId,
            url: imageUrl,
            alt_text: `${productName} - IA ${style} ${i + 1}`,
            is_primary: false,
            sort_order: currentImageCount + i + 1,
          });

          if (!insertError) successCount++;
        } catch (err) {
          console.error(`Failed to generate image ${i + 1}:`, err);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} imagem(ns) gerada(s) com sucesso!`);
        onImagesGenerated();
        onOpenChange(false);
      } else {
        toast.error('Nenhuma imagem foi gerada. Tente novamente.');
      }
    } catch (error) {
      console.error('Error in AI image generation:', error);
      toast.error('Erro ao gerar imagens');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Imagens com IA
          </DialogTitle>
          <DialogDescription>
            Crie variações da imagem principal usando inteligência artificial
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Preview of primary image */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <img src={primaryImageUrl} alt={productName} className="w-16 h-16 rounded object-cover" />
            <div>
              <p className="font-medium text-sm">{productName}</p>
              <p className="text-xs text-muted-foreground">Imagem de referência</p>
            </div>
          </div>

          {/* Style selector */}
          <div className="space-y-2">
            <Label>Estilo de geração</Label>
            <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <div className="flex items-center gap-2">
                      <s.icon className="h-4 w-4" />
                      <span>{s.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {STYLES.find((s) => s.value === style)?.description}
            </p>
          </div>

          {/* Quantity selector */}
          <div className="space-y-2">
            <Label>Quantidade de imagens</Label>
            <Select value={quantity} onValueChange={setQuantity} disabled={isGenerating}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: maxImages }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'imagem' : 'imagens'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isGenerating && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Gerando imagem {progress} de {quantity}...</p>
                <p className="text-xs text-muted-foreground">Cada imagem leva 10-30 segundos</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={isGenerating || maxImages === 0}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {isGenerating ? 'Gerando...' : 'Gerar Imagens'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
