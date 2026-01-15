// =============================================
// PAGES SETTINGS - Configure pages structure
// PASSO 2: Updated to use template-wide settings via useThemeSettings
// =============================================

import { 
  Home, 
  Grid3X3, 
  Package, 
  ShoppingCart, 
  CreditCard, 
  CheckCircle2, 
  User, 
  FileText, 
  Truck,
  BookOpen,
  ChevronRight,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PagesSettingsProps {
  tenantId: string;
  templateSetId?: string;
  onNavigateToPage?: (pageType: string) => void;
  onPageSelect?: (pageType: string) => void;
}

interface PageItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  hasSettings?: boolean;
  description?: string;
}

const pages: PageItem[] = [
  { id: 'home', label: 'Página Inicial', icon: <Home className="h-4 w-4" />, hasSettings: false, description: 'Layout e seções editáveis via blocos' },
  { id: 'category', label: 'Categoria', icon: <Grid3X3 className="h-4 w-4" />, hasSettings: true, description: 'Banner, nome e avaliações' },
  { id: 'product', label: 'Produto', icon: <Package className="h-4 w-4" />, hasSettings: true, description: 'Galeria, compre junto, avaliações' },
  { id: 'cart', label: 'Carrinho', icon: <ShoppingCart className="h-4 w-4" />, hasSettings: true, description: 'Frete, cupom, cross-sell' },
  { id: 'checkout', label: 'Checkout', icon: <CreditCard className="h-4 w-4" />, hasSettings: true, description: 'Timeline, order bump, depoimentos' },
  { id: 'thank_you', label: 'Obrigado', icon: <CheckCircle2 className="h-4 w-4" />, hasSettings: true, description: 'Upsell e WhatsApp' },
  { id: 'account', label: 'Minha Conta', icon: <User className="h-4 w-4" />, hasSettings: false, description: 'Área do cliente' },
  { id: 'account_orders', label: 'Pedidos', icon: <FileText className="h-4 w-4" />, hasSettings: false, description: 'Lista de pedidos' },
  { id: 'account_order_detail', label: 'Pedido', icon: <FileText className="h-4 w-4" />, hasSettings: false, description: 'Detalhe do pedido' },
  { id: 'tracking', label: 'Rastreio', icon: <Truck className="h-4 w-4" />, hasSettings: true, description: 'Formulário de rastreio' },
  { id: 'blog', label: 'Blog', icon: <BookOpen className="h-4 w-4" />, hasSettings: true, description: 'Listagem de posts' },
];

export function PagesSettings({ 
  tenantId, 
  templateSetId,
  onNavigateToPage,
  onPageSelect,
}: PagesSettingsProps) {
  const handlePageClick = (pageId: string, hasSettings: boolean) => {
    // Always navigate to the page first
    onNavigateToPage?.(pageId);
    
    // If page has settings, also show settings panel
    if (hasSettings && onPageSelect) {
      onPageSelect(pageId);
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-3">
        Clique para navegar e configurar cada página
      </p>
      
      {pages.map((page) => (
        <button
          key={page.id}
          onClick={() => handlePageClick(page.id, page.hasSettings || false)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
            'hover:bg-muted transition-colors text-left group'
          )}
        >
          <div className="flex-shrink-0 text-muted-foreground">
            {page.icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium block">{page.label}</span>
            {page.description && (
              <span className="text-[10px] text-muted-foreground line-clamp-1">{page.description}</span>
            )}
          </div>
          {page.hasSettings && (
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}
