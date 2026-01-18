// =============================================
// SKELETON BLOCKS - Referential structure blocks for editor
// AJUSTE 3: Visual placeholders when no real content exists
// These are ONLY shown in editor mode, never in public
// =============================================

import { Package, Grid3X3, ShoppingBag, ChevronRight, Search, ShoppingCart, User, Menu, Store, Phone, Mail, Facebook, Instagram } from 'lucide-react';

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

// =============================================
// HEADER SKELETON - Demo header for editor when no real config
// =============================================

interface HeaderSkeletonProps {
  isMobile?: boolean;
}

export function HeaderSkeleton({ isMobile = false }: HeaderSkeletonProps) {
  if (isMobile) {
    return (
      <div className="w-full bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-lg">
        {/* Mobile header */}
        <div className="flex items-center justify-between p-3">
          <Menu className="h-5 w-5 text-muted-foreground/40" />
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-muted-foreground/40" />
            <div className="h-4 w-20 bg-muted-foreground/20 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground/30" />
            <div className="relative">
              <ShoppingCart className="h-5 w-5 text-muted-foreground/40" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary/30 rounded-full text-[10px] flex items-center justify-center text-primary-foreground/50">0</span>
            </div>
          </div>
        </div>
        {/* Mobile search bar */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground/30" />
            <div className="h-3 w-32 bg-muted-foreground/20 rounded" />
          </div>
        </div>
        <p className="text-center text-muted-foreground/40 text-xs pb-2">
          [Demo] Configure em Configurações do tema → Cabeçalho
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-lg">
      {/* Notice bar demo */}
      <div className="bg-primary/10 py-1.5 px-4 text-center">
        <span className="text-primary/50 text-xs">✨ Mensagem de destaque - Configure na barra de avisos</span>
      </div>
      
      {/* Main header */}
      <div className="flex items-center justify-between p-4 border-b border-muted/30">
        {/* Search */}
        <div className="flex-1 max-w-xs">
          <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground/30" />
            <div className="h-3 w-24 bg-muted-foreground/20 rounded" />
          </div>
        </div>
        
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Store className="h-8 w-8 text-muted-foreground/40" />
          <div className="h-5 w-28 bg-muted-foreground/25 rounded" />
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground/40">
            <Phone className="h-4 w-4" />
            <span className="text-xs">Atendimento</span>
          </div>
          <User className="h-5 w-5 text-muted-foreground/40" />
          <div className="relative">
            <ShoppingCart className="h-5 w-5 text-muted-foreground/40" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary/30 rounded-full text-[10px] flex items-center justify-center text-primary-foreground/50">0</span>
          </div>
        </div>
      </div>
      
      {/* Secondary nav (menu) */}
      <div className="flex items-center justify-center gap-6 py-2 px-4">
        {['Categorias', 'Novidades', 'Promoções', 'Sobre'].map((item) => (
          <div key={item} className="text-muted-foreground/40 text-sm hover:text-muted-foreground/60 cursor-default">
            {item}
          </div>
        ))}
      </div>
      
      <p className="text-center text-muted-foreground/40 text-xs pb-2">
        [Demo] Configure em Configurações do tema → Cabeçalho
      </p>
    </div>
  );
}

// =============================================
// FOOTER SKELETON - Demo footer for editor when no real config
// =============================================

interface FooterSkeletonProps {
  isMobile?: boolean;
}

export function FooterSkeleton({ isMobile = false }: FooterSkeletonProps) {
  if (isMobile) {
    return (
      <div className="w-full bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-lg p-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Store className="h-8 w-8 text-muted-foreground/40" />
          <div className="h-5 w-24 bg-muted-foreground/25 rounded" />
        </div>
        
        {/* Description */}
        <div className="text-center mb-4">
          <div className="h-3 w-3/4 bg-muted-foreground/15 rounded mx-auto mb-1" />
          <div className="h-3 w-1/2 bg-muted-foreground/15 rounded mx-auto" />
        </div>
        
        {/* Social icons */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <Facebook className="h-5 w-5 text-muted-foreground/30" />
          <Instagram className="h-5 w-5 text-muted-foreground/30" />
          <Mail className="h-5 w-5 text-muted-foreground/30" />
        </div>
        
        {/* Contact info */}
        <div className="text-center text-xs text-muted-foreground/40 mb-4">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Phone className="h-3 w-3" />
            <span>(00) 0000-0000</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <Mail className="h-3 w-3" />
            <span>contato@loja.com</span>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="text-center text-xs text-muted-foreground/30 pt-3 border-t border-muted/30">
          © 2025 Nome da Loja. Todos os direitos reservados.
        </div>
        
        <p className="text-center text-muted-foreground/40 text-xs mt-3">
          [Demo] Configure em Configurações do tema → Rodapé
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-muted/30 border-2 border-dashed border-muted-foreground/20 rounded-lg p-6">
      <div className="grid grid-cols-4 gap-8">
        {/* Column 1: Logo + Description */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Store className="h-8 w-8 text-muted-foreground/40" />
            <div className="h-5 w-24 bg-muted-foreground/25 rounded" />
          </div>
          <div className="space-y-1">
            <div className="h-3 w-full bg-muted-foreground/15 rounded" />
            <div className="h-3 w-4/5 bg-muted-foreground/15 rounded" />
            <div className="h-3 w-3/5 bg-muted-foreground/15 rounded" />
          </div>
        </div>
        
        {/* Column 2: SAC */}
        <div>
          <div className="h-4 w-24 bg-muted-foreground/25 rounded mb-3" />
          <div className="space-y-2 text-xs text-muted-foreground/40">
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              <span>(00) 0000-0000</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3" />
              <span>contato@loja.com</span>
            </div>
          </div>
          {/* Social icons */}
          <div className="flex items-center gap-3 mt-4">
            <Facebook className="h-4 w-4 text-muted-foreground/30" />
            <Instagram className="h-4 w-4 text-muted-foreground/30" />
          </div>
        </div>
        
        {/* Column 3: Menu 1 */}
        <div>
          <div className="h-4 w-20 bg-muted-foreground/25 rounded mb-3" />
          <div className="space-y-2">
            {['Link 1', 'Link 2', 'Link 3'].map((item) => (
              <div key={item} className="text-xs text-muted-foreground/40">
                {item}
              </div>
            ))}
          </div>
        </div>
        
        {/* Column 4: Menu 2 */}
        <div>
          <div className="h-4 w-20 bg-muted-foreground/25 rounded mb-3" />
          <div className="space-y-2">
            {['Página 1', 'Página 2', 'Página 3'].map((item) => (
              <div key={item} className="text-xs text-muted-foreground/40">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Copyright */}
      <div className="text-center text-xs text-muted-foreground/30 pt-4 mt-4 border-t border-muted/30">
        © 2025 Nome da Loja. Todos os direitos reservados.
      </div>
      
      <p className="text-center text-muted-foreground/40 text-xs mt-3">
        [Demo] Configure em Configurações do tema → Rodapé
      </p>
    </div>
  );
}

// =============================================
// HELPER: Check if header/footer should show skeleton
// =============================================

export interface HeaderDataCheck {
  hasLogo: boolean;
  hasStoreName: boolean;
  hasMenuItems: boolean;
  hasContactInfo: boolean;
}

export interface FooterDataCheck {
  hasLogo: boolean;
  hasStoreName: boolean;
  hasDescription: boolean;
  hasContactInfo: boolean;
  hasMenuItems: boolean;
  hasSocialMedia: boolean;
}

export function shouldShowHeaderSkeleton(data: HeaderDataCheck): boolean {
  // Show skeleton if ALL key data is missing
  return !data.hasLogo && !data.hasStoreName && !data.hasMenuItems && !data.hasContactInfo;
}

export function shouldShowFooterSkeleton(data: FooterDataCheck): boolean {
  // Show skeleton if ALL key data is missing
  return !data.hasLogo && !data.hasStoreName && !data.hasDescription && 
         !data.hasContactInfo && !data.hasMenuItems && !data.hasSocialMedia;
}
