// =============================================
// HEADER/FOOTER PROPS EDITOR - Context-aware editing
// Home: Full global config | Other pages: Page-specific overrides
// Checkout: Separate layout (not synced with global)
// =============================================

import { BlockDefinition } from '@/lib/builder/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe, Settings, Info, RotateCcw, ShoppingBag, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PropsEditor } from './PropsEditor';
import { usePageOverrides, PageOverrides } from '@/hooks/usePageOverrides';
import { toast } from 'sonner';

interface HeaderFooterPropsEditorProps {
  definition: BlockDefinition;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  canDelete?: boolean;
  isHomePage: boolean;
  isCheckoutPage: boolean;
  blockType: 'Header' | 'Footer';
  // For page overrides
  tenantId: string;
  pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'institutional' | 'landing_page';
  pageId?: string;
}

export function HeaderFooterPropsEditor({
  definition,
  props,
  onChange,
  onDelete,
  onDuplicate,
  canDelete = true,
  isHomePage,
  isCheckoutPage,
  blockType,
  tenantId,
  pageType,
  pageId,
}: HeaderFooterPropsEditorProps) {
  // Fetch page overrides (only for non-home, non-checkout pages)
  const { 
    overrides, 
    isLoading, 
    updateHeaderOverrides,
    clearHeaderOverride,
  } = usePageOverrides({ tenantId, pageType, pageId });

  // Get global notice enabled value from props
  const globalNoticeEnabled = Boolean(props.noticeEnabled);
  
  // Check if there's an override
  const hasNoticeOverride = overrides?.header?.noticeEnabled !== undefined;
  
  // Get effective value (override > global)
  const effectiveNoticeEnabled = hasNoticeOverride 
    ? Boolean(overrides.header?.noticeEnabled) 
    : globalNoticeEnabled;

  // Handle toggle change - only creates override, never modifies global
  const handleNoticeToggle = async (checked: boolean) => {
    try {
      await updateHeaderOverrides.mutateAsync({ noticeEnabled: checked });
      toast.success('Configuração salva');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  // Handle revert to global - removes override
  const handleRevertToGlobal = async () => {
    try {
      await clearHeaderOverride.mutateAsync('noticeEnabled');
      toast.success('Revertido para configuração global');
    } catch (error) {
      toast.error('Erro ao reverter configuração');
    }
  };

  // =========================================
  // CHECKOUT: Separate layout (not global)
  // =========================================
  if (isCheckoutPage) {
    return (
      <div className="h-full flex flex-col border-l">
        {/* Header with Checkout-specific indicator */}
        <div className="p-4 border-b bg-amber-500/10">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-600" />
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {definition.label}
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300">
                  Checkout
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Layout separado do global (apenas checkout)
              </p>
            </div>
          </div>
        </div>

        {/* Full props editor for checkout config */}
        <div className="flex-1 overflow-hidden">
          <PropsEditor
            definition={definition}
            props={props}
            onChange={onChange}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            canDelete={canDelete}
          />
        </div>
      </div>
    );
  }

  // =========================================
  // HOME: Global configuration
  // =========================================
  if (isHomePage) {
    return (
      <div className="h-full flex flex-col border-l">
        {/* Header with Global indicator */}
        <div className="p-4 border-b bg-primary/5">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {definition.label}
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  Configuração Global
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Afeta todas as páginas (exceto Checkout)
              </p>
            </div>
          </div>
        </div>

        {/* Full props editor for global config */}
        <div className="flex-1 overflow-hidden">
          <PropsEditor
            definition={definition}
            props={props}
            onChange={onChange}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            canDelete={canDelete}
          />
        </div>
      </div>
    );
  }

  // =========================================
  // OTHER PAGES: Page-specific overrides only
  // =========================================
  return (
    <div className="h-full flex flex-col border-l">
      {/* Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              {definition.label}
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                Opções desta página
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Não altera configuração global
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Info about global inheritance */}
          <Alert className="bg-muted/50 border-muted">
            <Globe className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Este {blockType === 'Header' ? 'cabeçalho' : 'rodapé'} herda as configurações globais definidas na <strong>Página Inicial</strong>.
            </AlertDescription>
          </Alert>

          <Separator />

          {/* Page-specific overrides section - Header only */}
          {blockType === 'Header' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-4 w-4" />
                Personalizações desta página
              </div>

              {/* Notice Toggle Override */}
              <div className="rounded-lg border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notice-toggle" className="text-sm font-medium">
                      Exibir Aviso Geral
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {hasNoticeOverride 
                        ? 'Usando configuração desta página' 
                        : 'Herdando do global'}
                    </p>
                  </div>
                  <Switch
                    id="notice-toggle"
                    checked={effectiveNoticeEnabled}
                    onCheckedChange={handleNoticeToggle}
                    disabled={isLoading || updateHeaderOverrides.isPending}
                  />
                </div>

                {/* Inheritance indicator when no override */}
                {!hasNoticeOverride && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <div className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                    <span className="text-xs text-primary">
                      Herdando do global: {globalNoticeEnabled ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>
                )}

                {/* Override indicator when override exists */}
                {hasNoticeOverride && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                      <span className="text-xs text-amber-700">
                        Override ativo nesta página
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground hover:text-foreground"
                      onClick={handleRevertToGlobal}
                      disabled={clearHeaderOverride.isPending}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Voltar ao global
                    </Button>
                  </div>
                )}
              </div>

              {/* Info about more options coming */}
              <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center">
                <Info className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">
                  Mais opções de personalização em breve
                </p>
              </div>
            </div>
          )}

          {/* Footer has no overrides yet */}
          {blockType === 'Footer' && (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center">
              <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Em breve: opções para personalizar o rodapé apenas nesta página.
              </p>
            </div>
          )}

          <Separator />

          {/* Link to edit global settings */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Para alterar as configurações globais do {blockType === 'Header' ? 'cabeçalho' : 'rodapé'}:
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                window.location.href = '/storefront/builder?edit=home';
              }}
            >
              <Globe className="h-4 w-4" />
              Editar na Página Inicial
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
