import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorFallback } from '@/components/ui/error-fallback';
import { QueryErrorState } from '@/components/ui/query-error-state';
import { BlockErrorBoundary } from '@/components/builder/BlockErrorBoundary';

// Component that throws on render
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Erro forçado para teste de ErrorBoundary');
  return <div className="p-4 bg-accent rounded">✅ Bloco funcionando normalmente</div>;
}

export default function ErrorTestPage() {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [bombBlock, setBombBlock] = useState(false);
  const [boundaryKey, setBoundaryKey] = useState(0);

  if (showFullscreen) {
    return (
      <ErrorFallback
        variant="fullscreen"
        title="Erro simulado (fullscreen)"
        message="Esta é a tela de erro que aparece quando o sistema inteiro falha."
        onRetry={() => setShowFullscreen(false)}
        onReload={() => window.location.reload()}
        showSupport
        error={new Error('Erro simulado para teste visual')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-8 space-y-10 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold mb-2">🧪 Teste de UI de Erro</h1>
        <p className="text-muted-foreground">Página temporária para validar as 3 variantes do ErrorFallback.</p>
      </div>

      {/* Fullscreen */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold border-b pb-2">1. Fullscreen (Admin/Builder crash)</h2>
        <p className="text-sm text-muted-foreground">Simula a tela de erro que aparece quando o sistema inteiro falha.</p>
        <Button onClick={() => setShowFullscreen(true)}>Forçar erro fullscreen</Button>
      </section>

      {/* Card */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold border-b pb-2">2. Card (QueryErrorState — falha de seção)</h2>
        <p className="text-sm text-muted-foreground">Simula o erro que aparece quando uma seção não consegue carregar dados.</p>
        <QueryErrorState
          title="Erro ao carregar produtos"
          message="Não foi possível carregar a lista de produtos. Tente novamente."
          onRetry={() => alert('Tentando novamente...')}
          showSupportLink
        />
      </section>

      {/* Inline */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold border-b pb-2">3. Inline (BlockErrorBoundary — erro de bloco)</h2>
        <p className="text-sm text-muted-foreground">Simula o erro inline que aparece dentro de um bloco do editor.</p>
        
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <p className="text-xs text-muted-foreground">Simulação de canvas do Builder:</p>
          
          <div className="p-4 bg-accent rounded">✅ Bloco Header (ok)</div>
          
          <BlockErrorBoundary key={boundaryKey} blockId="test-123" blockType="Banner" pageType="home" isEditing>
            <Bomb shouldThrow={bombBlock} />
          </BlockErrorBoundary>
          
          <div className="p-4 bg-accent rounded">✅ Bloco Footer (ok)</div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={bombBlock ? 'destructive' : 'default'}
            onClick={() => {
              setBombBlock(true);
              setBoundaryKey(k => k + 1);
            }}
          >
            💥 Forçar erro no bloco
          </Button>
          {bombBlock && (
            <Button
              variant="outline"
              onClick={() => {
                setBombBlock(false);
                setBoundaryKey(k => k + 1);
              }}
            >
              Resetar bloco
            </Button>
          )}
        </div>
      </section>

      {/* Static preview of inline variant */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold border-b pb-2">4. Variante inline (estática)</h2>
        <p className="text-sm text-muted-foreground">Preview direto do componente ErrorFallback inline, sem boundary.</p>
        <ErrorFallback
          variant="inline"
          title="Erro no bloco: Slideshow"
          message="Este bloco encontrou um erro."
          onRetry={() => alert('Retry')}
          error={new Error('TypeError: Cannot read properties of undefined')}
        />
      </section>
    </div>
  );
}
