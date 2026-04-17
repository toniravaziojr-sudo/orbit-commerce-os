// =============================================
// CIRCLES VARIANT — Demo placeholder (Builder editor only)
// SRP: Show example categories when none are selected.
// =============================================

import { memo } from 'react';
import { ImageIcon } from 'lucide-react';

interface DemoLayoutProps {
  title: string;
  showName: boolean;
}

const DEMO_CATEGORIES = [
  { id: 'demo-1', name: 'Moda' },
  { id: 'demo-2', name: 'Eletrônicos' },
  { id: 'demo-3', name: 'Casa & Decoração' },
  { id: 'demo-4', name: 'Esportes' },
  { id: 'demo-5', name: 'Beleza' },
  { id: 'demo-6', name: 'Infantil' },
];

function DemoLayoutImpl({ title, showName }: DemoLayoutProps) {
  return (
    <section className="py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{title}</h2>
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {DEMO_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="group flex flex-col items-center cursor-pointer"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-muted/30 overflow-hidden mb-2 ring-2 ring-transparent group-hover:ring-primary transition-all flex items-center justify-center">
                <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/30" />
              </div>
              {showName && (
                <span className="text-xs sm:text-sm font-medium text-center mt-1 group-hover:text-primary transition-colors line-clamp-2">
                  {cat.name}
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-center text-muted-foreground mt-4">
          [Exemplo demonstrativo] Selecione categorias reais no painel lateral
        </p>
      </div>
    </section>
  );
}

export const DemoLayout = memo(DemoLayoutImpl);
