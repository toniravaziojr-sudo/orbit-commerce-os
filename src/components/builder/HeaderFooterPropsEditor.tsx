// =============================================
// HEADER/FOOTER PROPS EDITOR - Context-aware editing
// Home: Full global config | Other pages: Page-specific overrides
// =============================================

import { BlockDefinition } from '@/lib/builder/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Globe, Settings, Info, RotateCcw } from 'lucide-react';
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
  // Fetch page overrides
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

  // Handle toggle change
  const handleNoticeToggle = async (checked: boolean) => {
    try {
      await updateHeaderOverrides.mutateAsync({ noticeEnabled: checked });
      toast.success('Configuração salva');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  // Handle revert to global
  const handleRevertToGlobal = async () => {
    try {
      await clearHeaderOverride.mutateAsync('noticeEnabled');
      toast.success('Revertido para configuração global');
    } catch (error) {
      toast.error('Erro ao reverter configuração');
    }
  };

  // Checkout pages have their own separate header/footer, show full editor
  if (isCheckoutPage) {
    return (
      <PropsEditor
        definition={definition}
        props={props}
        onChange={onChange}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        canDelete={canDelete}
      />
    );
  }

  // Home page: show full global configuration
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
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Global
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Configurações aplicadas em todas as páginas
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

  // Other pages: show page-specific overrides panel (placeholder for now)
  return (
    <div className="h-full flex flex-col border-l">
      {/* Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xl">{definition.icon}</span>
          <div>
            <h3 className="font-semibold text-sm">{definition.label}</h3>
            <p className="text-xs text-muted-foreground">Opções desta página</p>
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

          {/* Page-specific overrides section */}
          {blockType === 'Header' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-4 w-4" />
                Configurações desta página
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
                        : 'Herdando configuração global'}
                    </p>
                  </div>
                  <Switch
                    id="notice-toggle"
                    checked={effectiveNoticeEnabled}
                    onCheckedChange={handleNoticeToggle}
                    disabled={isLoading || updateHeaderOverrides.isPending}
                  />
                </div>

                {/* Show revert button if there's an override */}
                {hasNoticeOverride && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground hover:text-foreground"
                      onClick={handleRevertToGlobal}
                      disabled={clearHeaderOverride.isPending}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reverter para global
                    </Button>
                  </div>
                )}

                {/* Show global status indicator */}
                {!hasNoticeOverride && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-primary/50" />
                    Global: {globalNoticeEnabled ? 'Ativado' : 'Desativado'}
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
