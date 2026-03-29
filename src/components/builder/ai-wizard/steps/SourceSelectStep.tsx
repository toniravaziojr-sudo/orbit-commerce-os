// =============================================
// SOURCE SELECT STEP — Validates that BannerProducts has source configured
// Reads from existing block props; does NOT let user reconfigure here
// =============================================

import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface SourceSelectStepProps {
  currentProps: Record<string, unknown>;
}

export function SourceSelectStep({ currentProps }: SourceSelectStepProps) {
  const source = currentProps.source as string;
  const productIds = currentProps.productIds as string[] | undefined;
  const categoryId = currentProps.categoryId as string | undefined;

  const isManualValid = source === 'manual' && Array.isArray(productIds) && productIds.length > 0;
  const isCategoryValid = source === 'category' && !!categoryId;
  const isValid = isManualValid || isCategoryValid;

  return (
    <div className="space-y-3">
      <div className={`flex items-start gap-3 p-3 rounded-lg border ${isValid ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}`}>
        {isValid ? (
          <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
        )}
        <div>
          {isValid ? (
            <>
              <p className="text-sm font-medium">Fonte configurada</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isManualValid
                  ? `${productIds!.length} produto(s) selecionado(s)`
                  : 'Categoria selecionada'}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-destructive">Fonte não configurada</p>
              <p className="text-xs text-muted-foreground mt-1">
                Antes de usar a IA, selecione os produtos ou a categoria no painel de propriedades do bloco.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}