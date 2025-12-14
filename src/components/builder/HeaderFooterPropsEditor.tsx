// =============================================
// HEADER/FOOTER PROPS EDITOR - Context-aware editing
// Home: Full global config | Other pages: Page-specific overrides
// =============================================

import { BlockDefinition } from '@/lib/builder/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Globe, Settings, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PropsEditor } from './PropsEditor';

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
}: HeaderFooterPropsEditorProps) {
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
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Settings className="h-4 w-4" />
              Configurações desta página
            </div>

            {/* Placeholder for future overrides */}
            <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center">
              <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Em breve: opções para personalizar o {blockType === 'Header' ? 'cabeçalho' : 'rodapé'} apenas nesta página.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Por exemplo: exibir/ocultar o aviso geral
              </p>
            </div>
          </div>

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
                // Navigate to home page editor
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
