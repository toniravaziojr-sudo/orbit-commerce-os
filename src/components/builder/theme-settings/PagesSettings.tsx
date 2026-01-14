// =============================================
// PAGES SETTINGS - Configure pages structure
// =============================================

import { useState } from 'react';
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
}

const pages: PageItem[] = [
  { id: 'home', label: 'Página Inicial', icon: <Home className="h-4 w-4" /> },
  { id: 'category', label: 'Categoria', icon: <Grid3X3 className="h-4 w-4" />, hasSettings: true },
  { id: 'product', label: 'Produto', icon: <Package className="h-4 w-4" />, hasSettings: true },
  { id: 'cart', label: 'Carrinho', icon: <ShoppingCart className="h-4 w-4" />, hasSettings: true },
  { id: 'checkout', label: 'Checkout', icon: <CreditCard className="h-4 w-4" />, hasSettings: true },
  { id: 'thank_you', label: 'Obrigado', icon: <CheckCircle2 className="h-4 w-4" />, hasSettings: true },
  { id: 'account', label: 'Minha Conta', icon: <User className="h-4 w-4" /> },
  { id: 'account_orders', label: 'Pedidos', icon: <FileText className="h-4 w-4" /> },
  { id: 'account_order_detail', label: 'Pedido', icon: <FileText className="h-4 w-4" /> },
  { id: 'tracking', label: 'Rastreio', icon: <Truck className="h-4 w-4" /> },
  { id: 'blog', label: 'Blog', icon: <BookOpen className="h-4 w-4" /> },
];

export function PagesSettings({ 
  tenantId, 
  templateSetId,
  onNavigateToPage,
  onPageSelect,
}: PagesSettingsProps) {
  const handlePageClick = (pageId: string, hasSettings: boolean) => {
    // If page has settings, show settings panel first
    if (hasSettings && onPageSelect) {
      onPageSelect(pageId);
    } else {
      // Otherwise navigate directly to edit
      onNavigateToPage?.(pageId);
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-3">
        Clique em uma página para ver suas configurações
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
          <span className="flex-1 text-sm font-medium">{page.label}</span>
          {page.hasSettings && (
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
    </div>
  );
}
