// =============================================
// SKELETON BLOCKS - Referential structure blocks for editor
// AJUSTE 3: Visual placeholders when no real content exists
// These are ONLY shown in editor mode, never in public
// =============================================

import { Package, Grid3X3, ShoppingBag, ChevronRight } from 'lucide-react';

interface SkeletonSectionProps {
  label: string;
  heightClass?: string;
}

export function SkeletonSection({ label, heightClass = 'h-32' }: SkeletonSectionProps) {
  return (
    <div className={`w-full ${heightClass} bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-lg flex items-center justify-center`}>
      <div className="text-center">
        <div className="text-muted-foreground/50 text-sm font-medium">{label}</div>
        <div className="text-muted-foreground/30 text-xs mt-1">Estrutura referencial</div>
      </div>
    </div>
  );
}

export function SkeletonBreadcrumb() {
  return (
    <div className="w-full py-3 px-4 bg-muted/20 rounded flex items-center gap-2">
      <div className="h-3 w-16 bg-muted-foreground/20 rounded animate-pulse" />
      <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
      <div className="h-3 w-24 bg-muted-foreground/20 rounded animate-pulse" />
      <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
      <div className="h-3 w-20 bg-muted-foreground/30 rounded animate-pulse" />
    </div>
  );
}

interface SkeletonProductGridProps {
  columns?: number;
}

export function SkeletonProductGrid({ columns = 4 }: SkeletonProductGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }[columns] || 'grid-cols-4';

  return (
    <div className={`w-full grid ${gridCols} gap-4 p-4`}>
      {Array.from({ length: columns * 2 }).map((_, i) => (
        <SkeletonProductCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonProductCard() {
  return (
    <div className="bg-muted/20 border border-dashed border-muted-foreground/20 rounded-lg p-3">
      {/* Image placeholder */}
      <div className="aspect-square bg-muted/40 rounded-md flex items-center justify-center mb-3">
        <Package className="h-8 w-8 text-muted-foreground/30" />
      </div>
      {/* Title */}
      <div className="h-4 w-3/4 bg-muted-foreground/20 rounded mb-2" />
      {/* Price */}
      <div className="h-5 w-1/2 bg-muted-foreground/30 rounded" />
    </div>
  );
}

interface SkeletonTwoColumnProps {
  leftLabel: string;
  rightLabel: string;
}

export function SkeletonTwoColumn({ leftLabel, rightLabel }: SkeletonTwoColumnProps) {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
      {/* Left column (2/3) */}
      <div className="md:col-span-2 bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-lg min-h-[200px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground/50 text-sm font-medium">{leftLabel}</div>
          <div className="text-muted-foreground/30 text-xs mt-1">Área principal</div>
        </div>
      </div>
      {/* Right column (1/3) */}
      <div className="bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-lg min-h-[200px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground/50 text-sm font-medium">{rightLabel}</div>
          <div className="text-muted-foreground/30 text-xs mt-1">Barra lateral</div>
        </div>
      </div>
    </div>
  );
}

// Feature-specific skeletons
interface FeatureSkeletonProps {
  label: string;
  description?: string;
}

export function FeatureSkeleton({ label, description }: FeatureSkeletonProps) {
  return (
    <div className="w-full py-6 px-4 bg-primary/5 border border-dashed border-primary/20 rounded-lg">
      <div className="flex items-center gap-2 justify-center">
        <ShoppingBag className="h-5 w-5 text-primary/40" />
        <span className="text-primary/60 text-sm font-medium">{label}</span>
      </div>
      {description && (
        <p className="text-center text-primary/40 text-xs mt-2">{description}</p>
      )}
      <p className="text-center text-muted-foreground/50 text-xs mt-3">
        Configure em Aumentar Ticket para exibir ofertas reais
      </p>
    </div>
  );
}

// Cross-sell / You might also like skeleton
export function CrossSellSkeleton() {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="h-6 w-48 bg-muted-foreground/20 rounded" />
      </div>
      <div className="grid grid-cols-4 gap-4 px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonProductCard key={i} />
        ))}
      </div>
    </div>
  );
}

// Buy Together skeleton
export function BuyTogetherSkeleton() {
  return (
    <div className="w-full py-4 px-4">
      <div className="h-6 w-32 bg-muted-foreground/20 rounded mb-4" />
      <div className="flex items-center gap-4">
        <div className="flex-1 bg-muted/30 border border-dashed border-muted-foreground/20 rounded-lg p-4 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
          <div className="h-4 w-20 bg-muted-foreground/20 rounded mx-auto" />
        </div>
        <span className="text-2xl text-muted-foreground/30">+</span>
        <div className="flex-1 bg-muted/30 border border-dashed border-muted-foreground/20 rounded-lg p-4 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
          <div className="h-4 w-20 bg-muted-foreground/20 rounded mx-auto" />
        </div>
        <span className="text-2xl text-muted-foreground/30">=</span>
        <div className="bg-primary/10 border border-dashed border-primary/30 rounded-lg p-4 text-center min-w-[120px]">
          <div className="h-6 w-16 bg-primary/30 rounded mx-auto mb-2" />
          <div className="h-8 w-24 bg-primary/40 rounded mx-auto" />
        </div>
      </div>
      <p className="text-center text-muted-foreground/50 text-xs mt-4">
        Configure "Compre Junto" em Aumentar Ticket para exibir ofertas reais
      </p>
    </div>
  );
}

// Order Bump skeleton
export function OrderBumpSkeleton() {
  return (
    <div className="w-full p-4 bg-amber-500/10 border border-dashed border-amber-500/30 rounded-lg">
      <div className="flex items-start gap-4">
        <div className="w-4 h-4 border-2 border-amber-500/50 rounded mt-1" />
        <div className="flex-1">
          <div className="h-5 w-48 bg-amber-500/30 rounded mb-2" />
          <div className="h-4 w-full bg-amber-500/20 rounded mb-1" />
          <div className="h-4 w-2/3 bg-amber-500/20 rounded" />
        </div>
        <div className="text-right">
          <div className="h-4 w-16 bg-amber-500/30 rounded line-through mb-1" />
          <div className="h-6 w-20 bg-amber-500/40 rounded" />
        </div>
      </div>
      <p className="text-center text-amber-600/50 text-xs mt-4">
        Configure Order Bump em Aumentar Ticket para exibir ofertas reais
      </p>
    </div>
  );
}

// Testimonials skeleton
export function TestimonialsSkeleton() {
  return (
    <div className="w-full py-4">
      <div className="flex gap-4 overflow-hidden px-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-64 bg-muted/30 border border-dashed border-muted-foreground/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full bg-muted-foreground/20" />
              <div>
                <div className="h-4 w-20 bg-muted-foreground/20 rounded mb-1" />
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="w-3 h-3 bg-amber-400/40 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
            <div className="h-3 w-full bg-muted-foreground/15 rounded mb-1" />
            <div className="h-3 w-4/5 bg-muted-foreground/15 rounded mb-1" />
            <div className="h-3 w-3/5 bg-muted-foreground/15 rounded" />
          </div>
        ))}
      </div>
      <p className="text-center text-muted-foreground/50 text-xs mt-4">
        Configure depoimentos em Checkout → Depoimentos
      </p>
    </div>
  );
}

// Timeline skeleton (checkout steps)
export function TimelineSkeleton() {
  return (
    <div className="w-full py-4 px-4">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {['Dados', 'Entrega', 'Pagamento'].map((step, i) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${i === 0 ? 'bg-primary/40' : 'bg-muted-foreground/20'}`}>
              <span className={`text-sm font-medium ${i === 0 ? 'text-primary-foreground/70' : 'text-muted-foreground/50'}`}>{i + 1}</span>
            </div>
            <span className={`ml-2 text-sm ${i === 0 ? 'text-foreground/70' : 'text-muted-foreground/50'}`}>{step}</span>
            {i < 2 && <div className="w-12 h-0.5 bg-muted-foreground/20 mx-2" />}
          </div>
        ))}
      </div>
    </div>
  );
}
