import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Sparkles, Check, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PresetPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: 'standard' | 'blank';
  onUsePreset: () => void;
  isLoading?: boolean;
}

// URL da loja demo para preview real
const DEMO_STORE_URL = 'https://respeiteohomem.comandocentral.com.br';

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
    // Páginas para navegação no iframe
    pages: [
      { name: 'Home', path: '' },
      { name: 'Produto', path: '/produto/kit-barba-completo' },
      { name: 'Checkout', path: '/checkout' },
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
      { name: 'Home', path: '' },
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
  const [iframeLoading, setIframeLoading] = useState(true);
  
  const info = PRESET_INFO[preset];
  const currentPage = info.pages[activePageIndex];
  
  // URL completa para o iframe
  const iframeUrl = `${DEMO_STORE_URL}${currentPage.path}`;
  
  // Reset loading state when page changes
  const handlePageChange = (index: number) => {
    setActivePageIndex(index);
    setIframeLoading(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
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
            
            {/* Open in new tab */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open(iframeUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir em nova aba
            </Button>
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
                      onClick={() => handlePageChange(index)}
                    >
                      {page.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Preview Frame - Real iframe */}
            <div className="flex-1 bg-muted/50 rounded-lg border overflow-hidden flex items-center justify-center p-4 min-h-[500px]">
              <div
                className={cn(
                  "bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 relative",
                  viewport === 'desktop' ? "w-full h-full" : "w-[375px] h-[667px]"
                )}
              >
                {/* Loading indicator */}
                {iframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Carregando preview...</span>
                    </div>
                  </div>
                )}
                
                {preset === 'standard' ? (
                  <iframe
                    src={iframeUrl}
                    className="w-full h-full border-0"
                    title={`Preview ${currentPage.name}`}
                    onLoad={() => setIframeLoading(false)}
                  />
                ) : (
                  // For blank preset, show a placeholder
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/10">
                    <div className="text-center p-8">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-lg mb-2">Template em Branco</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Sua loja começará com uma estrutura limpa, pronta para você personalizar do seu jeito.
                      </p>
                    </div>
                  </div>
                )}
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
