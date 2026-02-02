import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, Smartphone, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PresetPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: 'standard' | 'blank';
  onUsePreset: () => void;
  isLoading?: boolean;
}

const PRESET_INFO = {
  standard: {
    name: 'Template Padrão',
    badge: 'Recomendado',
    description: 'Template profissional pré-configurado com banner, categorias, produtos em destaque, checkout otimizado e cores premium.',
    features: [
      'Hero Banner rotativo',
      'Categorias em destaque',
      'Produtos mais vendidos',
      'Checkout com header/footer exclusivos',
      'Tema dark premium',
      'Página de conta do cliente',
    ],
    // Screenshots/mockups das páginas
    pages: [
      { name: 'Home', preview: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=800&fit=crop&q=80' },
      { name: 'Produto', preview: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&h=800&fit=crop&q=80' },
      { name: 'Checkout', preview: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=800&fit=crop&q=80' },
    ],
  },
  blank: {
    name: 'Iniciar do Zero',
    badge: 'Avançado',
    description: 'Estrutura limpa para personalização completa. A Home fica vazia para você criar, e as páginas padrão (produto, carrinho, checkout) vêm com estrutura básica funcional.',
    features: [
      'Home completamente personalizável',
      'Header e Footer básicos',
      'Páginas de sistema funcionais',
      'Total liberdade de design',
    ],
    pages: [
      { name: 'Home', preview: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=800&fit=crop&q=80' },
    ],
  },
};

export function PresetPreviewDialog({
  open,
  onOpenChange,
  preset,
  onUsePreset,
  isLoading,
}: PresetPreviewDialogProps) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [activePageIndex, setActivePageIndex] = useState(0);
  
  const info = PRESET_INFO[preset];
  const currentPage = info.pages[activePageIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="flex items-center gap-2">
                  {info.name}
                  <Badge variant={preset === 'standard' ? 'default' : 'secondary'}>
                    {info.badge}
                  </Badge>
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {info.description}
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mt-4">
          {/* Preview Area */}
          <div className="flex flex-col gap-4 min-h-0">
            {/* Viewport Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={viewport === 'desktop' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2"
                  onClick={() => setViewport('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                  Desktop
                </Button>
                <Button
                  variant={viewport === 'mobile' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2"
                  onClick={() => setViewport('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                  Mobile
                </Button>
              </div>

              {/* Page tabs */}
              {info.pages.length > 1 && (
                <div className="flex items-center gap-1">
                  {info.pages.map((page, index) => (
                    <Button
                      key={page.name}
                      variant={activePageIndex === index ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setActivePageIndex(index)}
                    >
                      {page.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Preview Frame */}
            <div className="flex-1 bg-muted/50 rounded-lg border overflow-hidden flex items-center justify-center p-4">
              <div
                className={cn(
                  "bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300",
                  viewport === 'desktop' ? "w-full max-w-4xl aspect-[16/10]" : "w-[375px] aspect-[9/16]"
                )}
              >
                <img
                  src={currentPage.preview}
                  alt={`Preview ${currentPage.name}`}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Features Sidebar */}
          <div className="flex flex-col gap-4">
            <div className="bg-muted/30 rounded-lg p-4 space-y-4">
              <h4 className="font-medium text-sm">O que está incluído:</h4>
              <ul className="space-y-2">
                {info.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto">
              <Button 
                className="w-full gap-2" 
                size="lg"
                onClick={onUsePreset}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {preset === 'standard' ? 'Usar este modelo' : 'Criar novo modelo'}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                {preset === 'standard' 
                  ? 'O template será criado e você poderá personalizar tudo'
                  : 'Você dará um nome ao modelo na próxima etapa'
                }
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
