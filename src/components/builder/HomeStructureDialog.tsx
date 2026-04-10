// =============================================
// HOME STRUCTURE DIALOG — AI-powered home page structure generation
// =============================================

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  Shirt,
  Sparkles as SparklesIcon,
  Cpu,
  UtensilsCrossed,
  CreditCard,
  Zap,
  Wand2,
  Loader2,
  Check,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { blockRegistry } from '@/lib/builder/registry';
import { generateBlockId } from '@/lib/builder/utils';
import type { BlockNode } from '@/lib/builder/types';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';

interface HomeStructureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyStructure: (content: BlockNode) => void;
  storeName?: string;
}

interface PresetStructure {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  blocks: string[];
}

const PRESETS: PresetStructure[] = [
  {
    id: 'general',
    label: 'Loja Geral',
    description: 'Estrutura versátil para qualquer segmento',
    icon: <Store className="h-5 w-5" />,
    blocks: ['Banner', 'Highlights', 'ProductShowcase', 'CategoryShowcase', 'SocialProof', 'NewsletterUnified'],
  },
  {
    id: 'fashion',
    label: 'Moda / Vestuário',
    description: 'Visual editorial com categorias em destaque',
    icon: <Shirt className="h-5 w-5" />,
    blocks: ['Banner', 'CategoryShowcase', 'ProductShowcase', 'ContentSection', 'SocialFeed', 'NewsletterUnified'],
  },
  {
    id: 'beauty',
    label: 'Cosméticos / Beleza',
    description: 'Passos de uso, prova social e feed visual',
    icon: <SparklesIcon className="h-5 w-5" />,
    blocks: ['Banner', 'Highlights', 'ProductShowcase', 'StepsTimeline', 'SocialProof', 'SocialFeed', 'NewsletterUnified'],
  },
  {
    id: 'electronics',
    label: 'Eletrônicos / Tech',
    description: 'Foco em specs, FAQ e números',
    icon: <Cpu className="h-5 w-5" />,
    blocks: ['Banner', 'Highlights', 'ProductShowcase', 'BannerProducts', 'FAQ', 'StatsNumbers', 'NewsletterUnified'],
  },
  {
    id: 'food',
    label: 'Alimentos / Bebidas',
    description: 'Conteúdo editorial e contato direto',
    icon: <UtensilsCrossed className="h-5 w-5" />,
    blocks: ['Banner', 'Highlights', 'ProductShowcase', 'ContentSection', 'SocialProof', 'ContactForm'],
  },
  {
    id: 'services',
    label: 'Serviços / Assinaturas',
    description: 'Tabela de preços, passos e FAQ',
    icon: <CreditCard className="h-5 w-5" />,
    blocks: ['Banner', 'PricingTable', 'Highlights', 'StepsTimeline', 'SocialProof', 'FAQ', 'ContactForm'],
  },
  {
    id: 'promo',
    label: 'Promocional / Black Friday',
    description: 'Urgência com countdown e ofertas',
    icon: <Zap className="h-5 w-5" />,
    blocks: ['Banner', 'CountdownTimer', 'ProductShowcase', 'BannerProducts', 'StatsNumbers', 'SocialProof', 'NewsletterUnified'],
  },
];

function buildPageContent(blockTypes: string[]): BlockNode {
  const contentBlocks = blockTypes
    .map(type => blockRegistry.createDefaultNode(type))
    .filter(Boolean) as BlockNode[];

  return {
    id: 'root',
    type: 'Page',
    props: {},
    children: [
      {
        id: generateBlockId('Header'),
        type: 'Header',
        props: { menuId: '', showSearch: true, showCart: true, sticky: true, noticeEnabled: false },
      },
      {
        id: generateBlockId('Section'),
        type: 'Section',
        props: { paddingY: 0, paddingX: 0, fullWidth: true, backgroundColor: 'transparent' },
        children: contentBlocks,
      },
      {
        id: generateBlockId('Footer'),
        type: 'Footer',
        props: { menuId: '', showSocial: true },
      },
    ],
  };
}

export function HomeStructureDialog({
  open,
  onOpenChange,
  onApplyStructure,
  storeName = 'Minha Loja',
}: HomeStructureDialogProps) {
  const [mode, setMode] = useState<'presets' | 'custom'>('presets');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const handleApplyPreset = (preset: PresetStructure) => {
    const content = buildPageContent(preset.blocks);
    onApplyStructure(content);
    onOpenChange(false);
    toast.success(`Estrutura "${preset.label}" aplicada! ✨`, {
      description: `${preset.blocks.length} blocos adicionados. Personalize o conteúdo no editor.`,
    });
  };

  const handleGenerateCustom = async () => {
    if (!customPrompt.trim()) return;
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-page-architect', {
        body: {
          prompt: customPrompt.trim(),
          pageName: storeName,
          context: 'home',
        },
      });

      if (error) throw new Error(error.message || 'Erro na geração com IA');
      if (!data?.success || !data?.blocks?.length) {
        throw new Error(data?.message || 'IA não retornou blocos válidos');
      }

      const blockTypes = data.blocks.map((b: { type: string }) => b.type);
      const content = buildPageContent(blockTypes);
      onApplyStructure(content);
      onOpenChange(false);
      toast.success('Estrutura gerada com IA! ✨', {
        description: `${blockTypes.length} blocos criados. Personalize o conteúdo no editor.`,
      });
    } catch (err) {
      console.error('[HomeStructureDialog] Error:', err);
      showErrorToast(err, { module: 'IA', action: 'gerar estrutura da home' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Criar Estrutura da Home Page
          </DialogTitle>
          <DialogDescription>
            Escolha um template pronto ou descreva sua loja para a IA criar uma estrutura personalizada.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2 border-b pb-3">
          <Button
            variant={mode === 'presets' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('presets')}
          >
            Templates Prontos
          </Button>
          <Button
            variant={mode === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('custom')}
          >
            <Wand2 className="h-3.5 w-3.5 mr-1" />
            Personalizado com IA
          </Button>
        </div>

        {mode === 'presets' ? (
          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="grid grid-cols-1 gap-3 pb-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id === selectedPreset ? null : preset.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:shadow-sm ${
                    selectedPreset === preset.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-md ${
                      selectedPreset === preset.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {preset.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{preset.label}</span>
                        {selectedPreset === preset.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {preset.blocks.map((block, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {block}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex flex-col gap-3">
            <Textarea
              placeholder="Descreva sua loja e o estilo da home page que deseja. Ex: 'Loja de roupas femininas focada em moda sustentável, com visual clean e moderno'"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="flex-1 min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              A IA vai analisar sua descrição e montar a melhor estrutura de blocos para sua home page.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {mode === 'presets' ? (
            <Button
              disabled={!selectedPreset}
              onClick={() => {
                const preset = PRESETS.find(p => p.id === selectedPreset);
                if (preset) handleApplyPreset(preset);
              }}
            >
              Aplicar Template
            </Button>
          ) : (
            <Button
              disabled={!customPrompt.trim() || isGenerating}
              onClick={handleGenerateCustom}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-1" />
                  Gerar com IA
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
