// =============================================
// CUSTOM CSS SETTINGS - Advanced styling
// =============================================

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface CustomCSSSettingsProps {
  tenantId: string;
  templateSetId?: string;
}

const exampleCSS = `/* Exemplo de CSS customizado */

/* Estilizar botões de compra */
.storefront-container .buy-button {
  border-radius: 8px;
  font-weight: 600;
}

/* Ajustar espaçamento de seções */
.storefront-container section {
  padding-top: 2rem;
  padding-bottom: 2rem;
}`;

export function CustomCSSSettings({ tenantId, templateSetId }: CustomCSSSettingsProps) {
  const [css, setCss] = useState('');
  const [isValid, setIsValid] = useState(true);

  const handleCSSChange = (value: string) => {
    setCss(value);
    // Basic CSS validation
    try {
      // Try to parse the CSS by checking for basic syntax issues
      const hasUnmatchedBraces = (value.match(/{/g) || []).length !== (value.match(/}/g) || []).length;
      setIsValid(!hasUnmatchedBraces);
    } catch {
      setIsValid(false);
    }
  };

  const handleCopyExample = () => {
    navigator.clipboard.writeText(exampleCSS);
    toast.success('Exemplo copiado!');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">CSS customizado</Label>
          {css && (
            isValid ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Válido
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                Erro de sintaxe
              </span>
            )
          )}
        </div>
        
        <Textarea
          value={css}
          onChange={(e) => handleCSSChange(e.target.value)}
          placeholder="/* Insira seu CSS customizado aqui */"
          className="min-h-[200px] font-mono text-xs resize-y"
        />
        
        <p className="text-xs text-muted-foreground">
          Use <code className="bg-muted px-1 rounded">.storefront-container</code> como prefixo para garantir que os estilos sejam aplicados corretamente.
        </p>
      </div>

      {/* Example */}
      <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Exemplo</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={handleCopyExample}
          >
            <Copy className="h-3 w-3" />
            Copiar
          </Button>
        </div>
        <pre className="text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
          {exampleCSS}
        </pre>
      </div>

      {/* Warning */}
      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <div className="flex gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
              Atenção
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              CSS customizado pode afetar o funcionamento da loja. Teste suas alterações no preview antes de publicar.
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        ⚠️ Alterações serão aplicadas ao salvar o tema
      </p>
    </div>
  );
}
